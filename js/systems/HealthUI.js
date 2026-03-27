/**
 * HealthUI.js
 * Genera el HUD de Salud Estilo SM64 (Power Meter)
 * Es un Widget SVG Circular superpuesto para optimización.
 */
export default class HealthUI {
    constructor(maxHealth = 8) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this._createUI();
    }

    _createUI() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '30px';
        this.container.style.right = '40px';
        this.container.style.width = '120px';
        this.container.style.height = '120px';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '1000';
        this.container.style.filter = 'drop-shadow(3px 3px 5px rgba(0,0,0,0.8))';
        
        // Círculo SVG que simula particiones (Quesitos de salud)
        this.container.innerHTML = `
            <svg width="120" height="120" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                <circle cx="50" cy="50" r="45" fill="#222" stroke="#FFF" stroke-width="4"/>
                <path id="healthPath" d="" fill="#ff3333" style="transition: fill 0.4s ease;"/>
                <!-- Líneas Separadoras (Quesitos) para emular secciones -->
                <g id="healthSectors" stroke="#222" stroke-width="3"></g>
                <circle cx="50" cy="50" r="20" fill="#111" stroke="#FFF" stroke-width="2"/>
                <text x="50" y="55" font-family="'Arial Black', Impact, sans-serif" font-weight="900" font-size="14" fill="#FFF" text-anchor="middle">HP</text>
            </svg>
        `;
        document.body.appendChild(this.container);
        
        this.pathEl = this.container.querySelector('#healthPath');
        const sectorsGrp = this.container.querySelector('#healthSectors');
        
        // Dibujado de las líneas divisoras (8 Gajos)
        for (let i = 0; i < this.maxHealth; i++) {
            const angle = (i / this.maxHealth) * Math.PI * 2;
            const x1 = 50 + 15 * Math.sin(angle); // Centro vacío para dejar texto legible
            const y1 = 50 - 15 * Math.cos(angle);
            const x2 = 50 + 45 * Math.sin(angle);
            const y2 = 50 - 45 * Math.cos(angle);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            sectorsGrp.appendChild(line);
        }

        this._createDeathScreen();
        this.update(this.maxHealth);
    }

    _createDeathScreen() {
        this.deathScreen = document.createElement('div');
        this.deathScreen.style.position = 'fixed';
        this.deathScreen.style.top = '0';
        this.deathScreen.style.left = '0';
        this.deathScreen.style.width = '100vw';
        this.deathScreen.style.height = '100vh';
        this.deathScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.deathScreen.style.display = 'none';
        this.deathScreen.style.flexDirection = 'column';
        this.deathScreen.style.justifyContent = 'center';
        this.deathScreen.style.alignItems = 'center';
        this.deathScreen.style.zIndex = '9999';
        this.deathScreen.style.fontFamily = 'Impact, "Arial Black", sans-serif';
        this.deathScreen.style.opacity = '0';
        this.deathScreen.style.transition = 'opacity 1.5s ease-in';
        
        this.deathScreen.innerHTML = `
            <h1 style="color: #ff3333; font-size: 8rem; margin: 0; text-shadow: 0 0 30px rgba(255,0,0,0.8); letter-spacing: 5px; text-transform: uppercase;">HAS MUERTO</h1>
            <p id="retryBtn" style="color: #fff; font-size: 2.5rem; border: 3px solid #fff; padding: 15px 40px; border-radius: 15px; margin-top: 50px; cursor: pointer; transition: all 0.3s; pointer-events: auto;">VOLVER A INTENTAR</p>
        `;
        
        document.body.appendChild(this.deathScreen);

        const retry = this.deathScreen.querySelector('#retryBtn');
        retry.addEventListener('mouseover', () => {
            retry.style.backgroundColor = '#fff';
            retry.style.color = '#000';
        });
        retry.addEventListener('mouseout', () => {
            retry.style.backgroundColor = 'transparent';
            retry.style.color = '#fff';
        });
        retry.addEventListener('click', () => {
            window.location.reload();
        });
    }

    showDeathScreen() {
        this.deathScreen.style.display = 'flex';
        // Forzar reflow para que corra la transición
        void this.deathScreen.offsetWidth;
        this.deathScreen.style.opacity = '1';
    }

    update(health) {
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, health));
        const pct = this.currentHealth / this.maxHealth;
        
        if (pct === 1.0) {
            // Un full-circle path workaround in SVG requires two arcs
            this.pathEl.setAttribute('d', `M50,5 A45,45 0 1,1 49.9,5 Z`);
            this.pathEl.setAttribute('fill', '#00ffaa'); // Verde Vida Llena
            return;
        }

        if (pct <= 0) {
            this.pathEl.setAttribute('d', '');
            return;
        }

        // Lógica de "Pie Chart" para los gajos
        const angle = pct * Math.PI * 2;
        const x = 50 + 45 * Math.sin(angle);
        const y = 50 - 45 * Math.cos(angle);
        const largeArc = pct > 0.5 ? 1 : 0;

        const d = `M50,50 L50,5 A45,45 0 ${largeArc},1 ${x},${y} Z`;
        this.pathEl.setAttribute('d', d);

        // Degradación Visual (Verde > Amarillo > Rojo)
        if (pct > 0.6) this.pathEl.setAttribute('fill', '#33cc55');
        else if (pct > 0.3) this.pathEl.setAttribute('fill', '#ffcc00');
        else this.pathEl.setAttribute('fill', '#ff3333');
    }
}
