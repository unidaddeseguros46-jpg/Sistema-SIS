if (new URLSearchParams(window.location.search).get('view') === 'modal') {
    document.documentElement.classList.add('is-modal');
    document.write('<style id="temp-modal-hide">body { display: none !important; }</style>');
    window.addEventListener('DOMContentLoaded', () => document.body.classList.add('is-modal'));
}
