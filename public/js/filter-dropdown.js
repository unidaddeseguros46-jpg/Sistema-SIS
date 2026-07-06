window.getScrollbarWidth = function () {
    var d = document.createElement('div');
    d.style.cssText = 'width:50px;height:50px;overflow-y:scroll;position:absolute;visibility:hidden;';
    document.body.appendChild(d);
    var s = d.offsetWidth - d.clientWidth;
    document.body.removeChild(d);
    return s || 17;
};

window.createFilterDropdown = function (cfg) {
    var dd = cfg.dropdownEl;
    var ls = cfg.listEl;
    var hs = cfg.hiddenSelectEl;
    var def = cfg.defaultText;
    var opts = cfg.options;

    function updateTrigger(val) {
        var el = dd.querySelector('.custom-select-text');
        if (!val) {
            el.textContent = def;
            el.style.color = '#94a3b8';
        } else {
            var match = ls.querySelector('.custom-select-option[data-value="' + val + '"]');
            el.textContent = match ? match.querySelector('span').textContent : val;
            el.style.color = '#1e293b';
        }
    }

    function populate() {
        ls.innerHTML = '';
        if (def) {
            var all = document.createElement('li');
            all.className = 'custom-select-option selected';
            all.setAttribute('role', 'option');
            all.dataset.value = '';
            var allText = document.createElement('span');
            allText.textContent = def;
            all.appendChild(allText);
            var allCheck = document.createElement('i');
            allCheck.className = 'fa-solid fa-check option-check';
            all.appendChild(allCheck);
            ls.appendChild(all);
        }
        opts.forEach(function (s) {
            var li = document.createElement('li');
            li.className = 'custom-select-option';
            li.setAttribute('role', 'option');
            var label = typeof s === 'object' ? s.label : s;
            var val = typeof s === 'object' ? s.value : s;
            li.dataset.value = val;
            var span = document.createElement('span');
            span.textContent = label;
            li.appendChild(span);
            var check = document.createElement('i');
            check.className = 'fa-solid fa-check option-check';
            li.appendChild(check);
            ls.appendChild(li);
        });
        updateTrigger('');
        if (!cfg.fixedWidth) {
            var w = ls.scrollWidth;
            if (w > 0) {
                dd.style.width = (w + window.getScrollbarWidth() + 10) + 'px';
            }
        }
    }
    populate();
    syncSelected();

    function syncSelected() {
        var val = hs.value;
        ls.querySelectorAll('.custom-select-option').forEach(function (opt) {
            opt.classList.toggle('selected', opt.dataset.value === val);
        });
        updateTrigger(val);
        if (hs.disabled) {
            dd.classList.add('is-disabled');
            dd.setAttribute('aria-disabled', 'true');
            dd.setAttribute('tabindex', '-1');
        } else {
            dd.classList.remove('is-disabled');
            dd.setAttribute('aria-disabled', 'false');
            dd.setAttribute('tabindex', '0');
        }
    }

    dd.addEventListener('click', function (e) {
        if (hs.disabled) return;
        if (e.target.closest('.custom-select-options')) return;
        e.stopPropagation();
        document.querySelectorAll('.filter-dropdown-wrapper.open').forEach(function (el) {
            if (el !== dd) { el.classList.remove('open'); el.setAttribute('aria-expanded', 'false'); }
        });
        dd.classList.toggle('open');
        var open = dd.classList.contains('open');
        dd.setAttribute('aria-expanded', open);
        if (open) { syncSelected(); dd.focus(); }
    });

    ls.addEventListener('click', function (e) {
        if (hs.disabled) return;
        var opt = e.target.closest('.custom-select-option');
        if (!opt || opt.classList.contains('is-disabled')) return;
        hs.value = opt.dataset.value;
        hs.dispatchEvent(new Event('change', { bubbles: true }));
        updateTrigger(opt.dataset.value);
        dd.classList.remove('open');
        dd.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('click', function (e) {
        if (!dd.contains(e.target)) {
            dd.classList.remove('open');
            dd.setAttribute('aria-expanded', 'false');
        }
    });

    dd.addEventListener('keydown', function (e) {
        if (hs.disabled) return;
        if (e.key === 'Escape') {
            dd.classList.remove('open');
            dd.setAttribute('aria-expanded', 'false');
            dd.blur();
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!dd.classList.contains('open')) {
                dd.classList.add('open');
                dd.setAttribute('aria-expanded', 'true');
                syncSelected();
                return;
            }
            var items = ls.querySelectorAll('.custom-select-option');
            var cur = ls.querySelector('.csd-hover') || ls.querySelector('.selected');
            var idx = -1;
            if (cur) { items.forEach(function (it, i) { if (it === cur) idx = i; }); }
            var next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
            if (next < 0) next = 0;
            if (next >= items.length) next = items.length - 1;
            items.forEach(function (it) { it.classList.remove('csd-hover'); });
            items[next].classList.add('csd-hover');
            items[next].scrollIntoView({ block: 'nearest' });
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (dd.classList.contains('open')) {
                var hovered = ls.querySelector('.csd-hover');
                if (hovered) { hovered.click(); }
            } else {
                dd.classList.add('open');
                dd.setAttribute('aria-expanded', 'true');
                syncSelected();
            }
        }
    });

    hs.customDropdownUpdate = syncSelected;
    return { syncSelected: syncSelected };
};
