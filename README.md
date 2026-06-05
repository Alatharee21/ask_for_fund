clone repo using `git clone <repo-url>` and run `npm install` to install dependencies.
Then run `npm start` to start the development server. The app will be available at `http://localhost:3000`.
To build the app for production, run `npm run build`. The optimized build will be output to the `build` directory. You can then deploy the contents of the `build` directory to your hosting provider.
Make sure to have Node.js and npm installed on your machine before running the above commands. You can download Node.js from the official website: https://nodejs.org/. This will also install npm, which is the package manager for JavaScript.
If you encounter any issues during installation or running the app, please check the error messages in the terminal for more details. You can also refer to the official React documentation for troubleshooting and additional information: https://reactjs.org/docs/getting-started.html.

### How I used Tatum API key in my project:
1. Signed up for a Tatum account at https://tatum.io/.
2. Created an API key in the Tatum dashboard.
3. set up environment variables to store your Tatum API key securely(mine exposed for some reasons). You can create a `.env` file in the root of your project and add the following line:
   ```
   VITE_TATUM_API_KEY=your_api_key_here
   ```
4. I imported VITE_TATUM_API_KEY from the environment variables in my code and used it to make API calls to Tatum for blockchain interactions. For example, I used it to fetch account balances, send transactions, and interact with smart contracts on supported blockchain networks.
5. I put the tatum testnet link in vite.config.js file as a proxy to avoid CORS issues during development. This allows the frontend to communicate with the Tatum API without running into cross-origin request problems. 
   ```javascript
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'https://api.tatum.io/v3',
           changeOrigin: true,
           rewrite: (path) => path.replace(/^\/api/, ''),
         },
       },
     },
   });
   ```

   ### How i used walrus blob storage in my project:
1. Signed up for a Walrus account at https://walrus.io/.
2. Created a blob storage container in the Walrus dashboard.
3. set up environment variables to store your Walrus storage account name and access key securely.
4. I imported the Walrus storage account name and access key from the environment variables in my code and used them to interact with the Walrus Blob Storage API. I used the API to upload files, retrieve file URLs, and manage my blob storage container as needed for my project.
5. I also implemented functionality in my app to allow users to upload files to the Walrus Blob Storage directly from the frontend, using the API to handle file uploads and generate accessible URLs for the uploaded files. This integration allowed me to efficiently manage and utilize blob storage for my application's needs.