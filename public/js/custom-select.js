/**
 * Custom Select Component
 * Convierte un <select class="custom-select-source"> en un dropdown moderno
 */
document.addEventListener('DOMContentLoaded', () => {
    const selects = document.querySelectorAll('.custom-select-source');
    
    selects.forEach(select => {
        // Crear contenedor principal
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        if (select.disabled) wrapper.classList.add('is-disabled');
        
        // Mantener las clases y estilos del padre original si era global-search-box
        const originalParent = select.closest('.global-search-box');
        
        // Crear el elemento seleccionado visual
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        
        const selectedText = document.createElement('span');
        selectedText.className = 'custom-select-text';
        
        // Obtener opción seleccionada o la primera por defecto
        const defaultOption = select.options[select.selectedIndex] || select.options[0];
        selectedText.textContent = defaultOption.text;
        
        if (defaultOption.value === "") {
            selectedText.style.color = '#94a3b8'; // Placeholder color
        } else {
            selectedText.style.color = '#1e293b'; // Texto activo
        }

        trigger.appendChild(selectedText);
        
        // Ocultar el select real pero mantenerlo en el DOM para el formulario
        select.style.display = 'none';
        
        // Crear la lista de opciones
        const optionsList = document.createElement('ul');
        optionsList.className = 'custom-select-options';
        
        // Llenar opciones
        Array.from(select.options).forEach((option, index) => {
            if(option.value === "" && index === 0 && option.text.includes("Filtrar")) {
                // Saltar la opcion de placeholder en la lista si queremos, o dejarla como "Todos"
                // Dejémosla como opcion "Todos" / "Limpiar"
            }
            
            const li = document.createElement('li');
            li.className = 'custom-select-option';
            li.dataset.value = option.value;
            
            // Icono de check (oculto por defecto)
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fa-solid fa-check option-check';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = option.text;
            
            li.appendChild(textSpan);
            li.appendChild(checkIcon);
            
            if (option.selected) {
                li.classList.add('selected');
            }
            
            // Click en opción
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Actualizar valor en el select original
                select.value = option.value;
                
                // Disparar evento change en el select original para que JS lo detecte
                select.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Actualizar texto seleccionado
                selectedText.textContent = option.text;
                if (option.value === "") {
                    selectedText.style.color = '#94a3b8';
                } else {
                    selectedText.style.color = '#1e293b';
                }
                
                // Actualizar clases selected
                wrapper.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
                li.classList.add('selected');
                
                // Cerrar dropdown
                wrapper.classList.remove('open');
            });
            
            optionsList.appendChild(li);
        });
        
        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsList);
        
        // Insertar el nuevo componente después del select original
        select.parentNode.insertBefore(wrapper, select.nextSibling);
        
        // Ajuste para que el componente ocupe todo el espacio del contenedor padre
        wrapper.style.flex = "1";
        wrapper.style.height = "100%";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";

        // Asegurar que el contenedor padre permita ver el desplegable
        if (select.parentNode.classList.contains('global-search-box')) {
            select.parentNode.style.overflow = 'visible';
        }
        
        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            if (select.disabled) return;
            e.stopPropagation();
            
            // Cerrar otros abiertos
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                if(w !== wrapper) w.classList.remove('open');
                w.classList.remove('open-up');
            });
            
            wrapper.classList.toggle('open');

            // Si se abrió, verificar espacio disponible
            if (wrapper.classList.contains('open')) {
                requestAnimationFrame(() => {
                    const rect = wrapper.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const optionsHeight = optionsList.scrollHeight || 250;
                    // Si no hay al menos 260px (options + gap) debajo, abrir hacia arriba
                    if (spaceBelow < optionsHeight + 10) {
                        wrapper.classList.add('open-up');
                    }
                });
            }
        });

        // Click en cualquier parte del global-search-box abre el dropdown
        const parentBox = select.closest('.global-search-box');
        if (parentBox) {
            parentBox.addEventListener('click', (e) => {
                if (e.target.closest('.custom-select-options')) return;
                trigger.click();
            });
        }
        
        // Permitir actualizar desde JS
        select.customDropdownUpdate = () => {
            const currentOpt = select.options[select.selectedIndex];
            selectedText.textContent = currentOpt ? currentOpt.text : '';
            if (currentOpt && currentOpt.value === "") {
                selectedText.style.color = '#94a3b8';
            } else {
                selectedText.style.color = '#1e293b';
            }
            wrapper.querySelectorAll('.custom-select-option').forEach(el => {
                if (el.dataset.value === select.value) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });
            // Sincronizar estado disabled
            wrapper.classList.toggle('is-disabled', select.disabled);
        };
    });
    
    // Cerrar click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                w.classList.remove('open', 'open-up');
            });
        }
    });
});
