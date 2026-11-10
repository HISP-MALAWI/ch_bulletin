/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',

    title: 'Climate and Health Bulletin',

    entryPoints: {
        app: './src/App.jsx',
    },

    direction: 'auto',

    // The dev server copies `src/` into `.d2/shell` and Vite watches that copy,
    // so a file is being written at the same moment it is being watched. On
    // Windows that race makes `fs.watch` fail with EBUSY, and Vite emits it as
    // an unhandled 'error' on the watcher — which kills the process instead of
    // logging and carrying on. Polling avoids `fs.watch` altogether.
    //
    // Vite already ignores node_modules, .git and its own cache, so this only
    // polls the app's own files, not the dependency tree.
    viteConfigExtensions: {
        server: {
            watch: {
                usePolling: true,
                interval: 300,
            },
        },
    },
}

module.exports = config
