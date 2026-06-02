/// ask_for_fund — Prediction Module
/// Handles daily SUI price direction predictions, oracle settlement,
/// and on-chain streak tracking via a soulbound profile object.
module ask_for_fund::prediction {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ── Error codes ────────────────────────────────────────────────────────────
    const E_ALREADY_PREDICTED_TODAY: u64 = 1;
    const E_WINDOW_NOT_CLOSED: u64      = 2;
    const E_ALREADY_SETTLED: u64        = 3;
    const E_NOT_ORACLE: u64             = 4;
    const E_NO_PENDING_PREDICTION: u64  = 5;

    // ── Direction constants ────────────────────────────────────────────────────
    /// Price rose >= 10 % vs previous snapshot
    const DIR_UP:   u8 = 0;
    /// Price moved within ± 10 %
    const DIR_FLAT: u8 = 1;
    /// Price fell >= 10 %
    const DIR_DOWN: u8 = 2;

    // Settlement window: predictions lock at UTC 00:00 and settle at next UTC 00:00
    // Expressed in milliseconds (Sui Clock uses ms)
    const DAY_MS: u64 = 86_400_000;

    // Threshold: 10 % expressed as basis points (1000 bp = 10 %)
    const THRESHOLD_BP: u64 = 1_000;
    const BP_DENOM:     u64 = 10_000;

    // ── Structs ────────────────────────────────────────────────────────────────

    /// Soulbound (non-transferable) profile owned by each participant.
    /// Stores their current streak and the last day they predicted.
    public struct PredictionProfile has key {
        id: UID,
        owner: address,
        /// Current consecutive correct streak (resets on wrong prediction)
        streak: u64,
        /// Longest streak ever achieved
        best_streak: u64,
        /// Total correct predictions all-time
        total_correct: u64,
        /// Total predictions submitted
        total_submitted: u64,
        /// UTC day index of the last submitted prediction (timestamp_ms / DAY_MS)
        last_day_index: u64,
        /// Pending prediction waiting for settlement (0xff = none)
        pending_direction: u8,
        /// Price snapshot (USD, scaled by 1e6) at time of prediction submission
        entry_price_usd: u64,
        /// Whether the pending prediction has been settled
        pending_settled: bool,
    }

    /// Shared oracle state — only the designated oracle address may post prices.
    public struct OracleState has key {
        id: UID,
        oracle_address: address,
        /// Latest settlement price (USD scaled 1e6)
        last_price_usd: u64,
        /// Timestamp (ms) of last price post
        last_price_ts: u64,
        /// Day index of last posted price
        last_day_index: u64,
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    public struct PredictionSubmitted has copy, drop {
        owner: address,
        direction: u8,
        entry_price_usd: u64,
        day_index: u64,
    }

    public struct PredictionSettled has copy, drop {
        owner: address,
        direction_submitted: u8,
        correct: bool,
        new_streak: u64,
        settlement_price_usd: u64,
    }

    public struct PricePosted has copy, drop {
        price_usd: u64,
        day_index: u64,
        posted_by: address,
    }

    // ── Init ───────────────────────────────────────────────────────────────────

    /// Called once at publish time. Creates the shared OracleState.
    fun init(ctx: &mut TxContext) {
        let oracle = OracleState {
            id: object::new(ctx),
            oracle_address: tx_context::sender(ctx),
            last_price_usd: 0,
            last_price_ts: 0,
            last_day_index: 0,
        };
        transfer::share_object(oracle);
    }

    // ── Profile creation ───────────────────────────────────────────────────────

    /// Anyone can create their own prediction profile (one per address enforced
    /// at the application layer — duplicate checks happen in grant_vault module).
    entry fun create_profile(ctx: &mut TxContext) {
        let profile = PredictionProfile {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            streak: 0,
            best_streak: 0,
            total_correct: 0,
            total_submitted: 0,
            last_day_index: 0,
            pending_direction: 0xff,
            entry_price_usd: 0,
            pending_settled: true,
        };
        // Transfer to sender — soulbound (no public transfer function exposed)
        transfer::transfer(profile, tx_context::sender(ctx));
    }

    // ── Submit prediction ──────────────────────────────────────────────────────

    /// Submit today's directional prediction.
    /// `direction`: 0 = UP, 1 = FLAT, 2 = DOWN
    /// Requires the oracle has posted a price for today (so we have an entry price).
    entry fun submit_prediction(
        profile: &mut PredictionProfile,
        oracle: &OracleState,
        direction: u8,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(direction <= 2, 99); // invalid direction guard

        let now_ms = clock::timestamp_ms(clock);
        let today  = now_ms / DAY_MS;

        // One prediction per day
        assert!(profile.last_day_index < today || profile.last_day_index == 0, E_ALREADY_PREDICTED_TODAY);

        // Previous prediction must be settled before submitting a new one
        assert!(profile.pending_settled, E_ALREADY_PREDICTED_TODAY);

        // Snapshot today's oracle price as the entry price
        let entry = oracle.last_price_usd;

        profile.pending_direction = direction;
        profile.entry_price_usd   = entry;
        profile.pending_settled   = false;
        profile.last_day_index    = today;
        profile.total_submitted   = profile.total_submitted + 1;

        event::emit(PredictionSubmitted {
            owner: tx_context::sender(ctx),
            direction,
            entry_price_usd: entry,
            day_index: today,
        });
    }

    // ── Oracle: post price ─────────────────────────────────────────────────────

    /// Oracle posts the settlement price once per day at UTC 00:00.
    /// In production this would be called by a Pyth Network price feed adapter.
    entry fun post_price(
        oracle: &mut OracleState,
        price_usd: u64,       // e.g. 3_840_000 = $3.84 (scaled 1e6)
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == oracle.oracle_address, E_NOT_ORACLE);

        let now_ms    = clock::timestamp_ms(clock);
        let day_index = now_ms / DAY_MS;

        assert!(day_index > oracle.last_day_index, E_ALREADY_SETTLED);

        oracle.last_price_usd = price_usd;
        oracle.last_price_ts  = now_ms;
        oracle.last_day_index = day_index;

        event::emit(PricePosted {
            price_usd,
            day_index,
            posted_by: tx_context::sender(ctx),
        });
    }

    // ── Settle prediction ──────────────────────────────────────────────────────

    /// Anyone (or a keeper bot) can call settle on a profile once the oracle
    /// has posted the next day's price. Updates the streak.
    entry fun settle_prediction(
        profile: &mut PredictionProfile,
        oracle: &OracleState,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(!profile.pending_settled, E_NO_PENDING_PREDICTION);

        let now_ms = clock::timestamp_ms(clock);
        let today  = now_ms / DAY_MS;

        // Settlement only allowed after the prediction day has ended
        assert!(today > profile.last_day_index, E_WINDOW_NOT_CLOSED);

        // Oracle must have a price for the settlement day
        assert!(oracle.last_day_index >= today, E_WINDOW_NOT_CLOSED);

        let entry = profile.entry_price_usd;
        let exit  = oracle.last_price_usd;

        let correct = is_prediction_correct(profile.pending_direction, entry, exit);

        if (correct) {
            profile.streak        = profile.streak + 1;
            profile.total_correct = profile.total_correct + 1;
            if (profile.streak > profile.best_streak) {
                profile.best_streak = profile.streak;
            };
        } else {
            profile.streak = 0;
        };

        profile.pending_settled = true;

        event::emit(PredictionSettled {
            owner: profile.owner,
            direction_submitted: profile.pending_direction,
            correct,
            new_streak: profile.streak,
            settlement_price_usd: exit,
        });

        let _ = ctx;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    fun is_prediction_correct(direction: u8, entry: u64, exit: u64): bool {
        if (direction == DIR_UP) {
            exit * BP_DENOM >= entry * (BP_DENOM + THRESHOLD_BP)
        } else if (direction == DIR_DOWN) {
            exit * BP_DENOM <= entry * (BP_DENOM - THRESHOLD_BP)
        } else {
            exit * BP_DENOM >= entry * (BP_DENOM - THRESHOLD_BP) &&
            exit * BP_DENOM <= entry * (BP_DENOM + THRESHOLD_BP)
        }
    }

    // ── Read-only accessors ────────────────────────────────────────────────────

    public fun streak(profile: &PredictionProfile): u64        { profile.streak }
    public fun owner(profile: &PredictionProfile): address     { profile.owner }
    public fun best_streak(profile: &PredictionProfile): u64   { profile.best_streak }
    public fun total_correct(profile: &PredictionProfile): u64 { profile.total_correct }
    public fun is_settled(profile: &PredictionProfile): bool   { profile.pending_settled }

    #[test_only]
    public fun init_for_test(ctx: &mut TxContext) { init(ctx); }

    #[test_only]
    public fun streak_for_test(profile: &PredictionProfile): u64 { profile.streak }
}