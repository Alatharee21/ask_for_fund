/// ask_for_fund — Vault Module
/// Funders lock SUI here and configure eligibility rules.
/// Only wallets that pass the EligibilityGate can submit grant requests.
/// Funders hold exclusive release authority.
module ask_for_fund::grant_vault {

    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};

    use ask_for_fund::prediction::{Self, PredictionProfile};

    // ── Errors ─────────────────────────────────────────────────────────────────
    const E_NOT_FUNDER: u64           = 10;
    const E_STREAK_TOO_SHORT: u64     = 11;
    const E_BALANCE_TOO_LOW: u64      = 12;
    const E_REQUEST_EXISTS: u64       = 13;
    const E_REQUEST_NOT_FOUND: u64    = 14;
    const E_AMOUNT_EXCEEDS_MAX: u64   = 15;
    const E_VAULT_INSUFFICIENT: u64   = 16;
    const E_PREDICTION_UNSETTLED: u64 = 17;
    const E_VAULT_CLOSED: u64         = 18;

    // ── Structs ────────────────────────────────────────────────────────────────

    /// Capability held by the funder — required for all admin actions.
    public struct FunderCap has key, store {
        id: UID,
        vault_id: ID,
    }

    /// Shared vault object — holds locked SUI and eligibility config.
    public struct GrantVault has key {
        id: UID,
        name: vector<u8>,
        funder: address,
        balance: Balance<SUI>,
        min_balance_mist: u64,
        min_streak: u64,
        max_grant_mist: u64,
        total_dispersed: u64,
        requests: Table<address, GrantRequest>,
        active: bool,
    }

    
    /*public struct GrantRequest has store, drop {
        applicant: address,
        amount_mist: u64,
        memo: vector<u8>,
        score: u64,
        streak_snapshot: u64,
    }*/

    /// A single grant request stored inside the vault.
    public struct GrantRequest has store, drop {
    applicant: address,
    amount_mist: u64,
    walrus_blob_id: vector<u8>,   // ← 32-byte Walrus blob ID
    walrus_object_id: address,
    score: u64,
    streak_snapshot: u64,
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        funder: address,
        initial_balance_mist: u64,
        min_streak: u64,
        min_balance_mist: u64,
        max_grant_mist: u64,
    }

    public struct VaultToppedUp has copy, drop {
        vault_id: ID,
        added_mist: u64,
        new_total_mist: u64,
    }

    public struct GrantRequested has copy, drop {
        vault_id: ID,
        applicant: address,
        amount_mist: u64,
        score: u64,
    }

    public struct GrantReleased has copy, drop {
        vault_id: ID,
        applicant: address,
        amount_mist: u64,
    }

    public struct GrantDeclined has copy, drop {
        vault_id: ID,
        applicant: address,
    }

    public struct VaultClosed has copy, drop {
        vault_id: ID,
        returned_mist: u64,
    }

    // ── Create vault ───────────────────────────────────────────────────────────

    entry fun create_vault(
        name: vector<u8>,
        initial_funds: Coin<SUI>,
        min_balance_mist: u64,
        min_streak: u64,
        max_grant_mist: u64,
        ctx: &mut TxContext,
    ) {
        let funder       = tx_context::sender(ctx);
        let initial_mist = coin::value(&initial_funds);

        let vault = GrantVault {
            id: object::new(ctx),
            name,
            funder,
            balance: coin::into_balance(initial_funds),
            min_balance_mist,
            min_streak,
            max_grant_mist,
            total_dispersed: 0,
            requests: table::new(ctx),
            active: true,
        };

        let vault_id = object::id(&vault);

        let cap = FunderCap {
            id: object::new(ctx),
            vault_id,
        };

        event::emit(VaultCreated {
            vault_id,
            funder,
            initial_balance_mist: initial_mist,
            min_streak,
            min_balance_mist,
            max_grant_mist,
        });

        transfer::share_object(vault);
        transfer::transfer(cap, funder);
    }

    // ── Top up vault ───────────────────────────────────────────────────────────

    entry fun top_up_vault(
        vault: &mut GrantVault,
        funds: Coin<SUI>,
        ctx: &TxContext,
    ) {
        assert!(vault.active, E_VAULT_CLOSED);
        let added = coin::value(&funds);
        balance::join(&mut vault.balance, coin::into_balance(funds));

        event::emit(VaultToppedUp {
            vault_id: object::id(vault),
            added_mist: added,
            new_total_mist: balance::value(&vault.balance),
        });

        let _ = ctx;
    }

    // ── Submit grant request ───────────────────────────────────────────────────

    entry fun request_grant(
    vault: &mut GrantVault,
    profile: &PredictionProfile,
    proof_coin: &Coin<SUI>,
    amount_mist: u64,
    walrus_blob_id: vector<u8>,
    walrus_object_id: address,
    ctx: &TxContext,
) {
    assert!(vault.active, E_VAULT_CLOSED);

    let applicant = tx_context::sender(ctx);

    assert!(prediction::streak(profile) >= vault.min_streak, E_STREAK_TOO_SHORT);
    assert!(prediction::is_settled(profile), E_PREDICTION_UNSETTLED);
    assert!(coin::value(proof_coin) >= vault.min_balance_mist, E_BALANCE_TOO_LOW);
    assert!(prediction::owner(profile) == applicant, E_NOT_FUNDER);
    assert!(amount_mist <= vault.max_grant_mist, E_AMOUNT_EXCEEDS_MAX);
    assert!(!table::contains(&vault.requests, applicant), E_REQUEST_EXISTS);

    // blob_id must be exactly 32 bytes
    assert!(vector::length(&walrus_blob_id) == 32, 20);

    let streak   = prediction::streak(profile);
    let bal      = coin::value(proof_coin);
    let bal_tier = if (bal >= vault.min_balance_mist * 10) { 9 }
                   else { (bal / vault.min_balance_mist) - 1 };
    let score    = streak * 10 + bal_tier;

    let request = GrantRequest {
        applicant,
        amount_mist,
        walrus_blob_id,
        walrus_object_id,
        score,
        streak_snapshot: streak,
    };

    table::add(&mut vault.requests, applicant, request);

    event::emit(GrantRequested {
        vault_id: object::id(vault),
        applicant,
        amount_mist,
        score,
    });
}


    // ── Approve grant ──────────────────────────────────────────────────────────

    entry fun approve_grant(
        cap: &FunderCap,
        vault: &mut GrantVault,
        applicant: address,
        ctx: &mut TxContext,
    ) {
        assert!(cap.vault_id == object::id(vault), E_NOT_FUNDER);
        assert!(table::contains(&vault.requests, applicant), E_REQUEST_NOT_FOUND);

        let request = table::remove(&mut vault.requests, applicant);
        let amount  = request.amount_mist;

        assert!(balance::value(&vault.balance) >= amount, E_VAULT_INSUFFICIENT);

        let payout = coin::from_balance(balance::split(&mut vault.balance, amount), ctx);
        vault.total_dispersed = vault.total_dispersed + amount;

        transfer::public_transfer(payout, applicant);

        event::emit(GrantReleased {
            vault_id: object::id(vault),
            applicant,
            amount_mist: amount,
        });
    }

    // ── Decline grant ──────────────────────────────────────────────────────────

    entry fun decline_grant(
        cap: &FunderCap,
        vault: &mut GrantVault,
        applicant: address,
        ctx: &TxContext,
    ) {
        assert!(cap.vault_id == object::id(vault), E_NOT_FUNDER);
        assert!(table::contains(&vault.requests, applicant), E_REQUEST_NOT_FOUND);

        table::remove(&mut vault.requests, applicant);

        event::emit(GrantDeclined {
            vault_id: object::id(vault),
            applicant,
        });

        let _ = ctx;
    }

    // ── Close vault ────────────────────────────────────────────────────────────

    entry fun close_vault(
        cap: &FunderCap,
        vault: &mut GrantVault,
        ctx: &mut TxContext,
    ) {
        assert!(cap.vault_id == object::id(vault), E_NOT_FUNDER);

        vault.active = false;
        let remaining = balance::value(&vault.balance);

        if (remaining > 0) {
            let refund = coin::from_balance(
                balance::split(&mut vault.balance, remaining),
                ctx,
            );
            transfer::public_transfer(refund, vault.funder);
        };

        event::emit(VaultClosed {
            vault_id: object::id(vault),
            returned_mist: remaining,
        });
    }

    // ── Read-only views ────────────────────────────────────────────────────────

    public fun vault_balance(vault: &GrantVault): u64   { balance::value(&vault.balance) }
    public fun min_streak(vault: &GrantVault): u64      { vault.min_streak }
    public fun min_balance(vault: &GrantVault): u64     { vault.min_balance_mist }
    public fun max_grant(vault: &GrantVault): u64       { vault.max_grant_mist }
    public fun is_active(vault: &GrantVault): bool      { vault.active }
    public fun total_dispersed(vault: &GrantVault): u64 { vault.total_dispersed }
    public fun has_request(vault: &GrantVault, addr: address): bool {
        table::contains(&vault.requests, addr)
    }
}