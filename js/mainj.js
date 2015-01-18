require.config(config);

require([
    'jquery',
    'slamj/SlamClientApp'
], function(
    $,
    SlamClientApp
) {
    window.app = new SlamClientApp(document.body);
    window.app.start();
});
