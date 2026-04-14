<template>
  <div
    class="folder-row"
    :class="{ selected }"
    :data-id="folder.folder_id"
    @click="$emit('click', $event)"
    @dblclick="$emit('dblclick', $event)"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <div class="row-icon">
      <svg
        width="32"
        height="32"
        version="1.1"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
      >
        <defs>
          <linearGradient
            id="linearGradient946"
            x1="445.28"
            x2="445.28"
            y1="181.8"
            y2="200.07"
            gradientTransform="matrix(1.4724 0 0 1.4432 -625.58 -239.75)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#ffffff" stop-opacity="0" offset="0" />
            <stop stop-color="#ffffff" offset="1" />
          </linearGradient>
        </defs>
        <image
          x="2.5"
          y="49.215"
          width="59"
          height="10"
          image-rendering="optimizeQuality"
          opacity=".5"
          preserveAspectRatio="none"
          xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAKCAYAAAAKAya7AAAACXBIWXMAAA7DAAAOwwHHb6hkAAAA GXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAMFJREFUSInVltEOwyAIRaH1/794 rXvBhF2vDhb6MBIC1gY4gVpV6kQLY6H0iiCRAvEdTfrRPAjUkz5bh4pQZzMq4GMOlm8H0sGPKsai yX3hh9MT1kN3wLs8TFZdYjA30QvWCC9tATrgmvnN1INHIKOgK2D/jAEPwJfpZVbN/4hxJAr5e4mO MRtllbnDQizLw4R9u6yrt8yjjCNMx/ipA4rZVb5vkAhbdkAxif56dnu/dhb9zN4k1ReBJy4WJRcK EZE37lJlFEBdtGUAAAAASUVORK5CYII="
        />
        <path
          :style="{ color: folder.color }"
          d="m8.3493 8.996h10.187c2.8348 0 2.9596 0.10961 5.8283 2.3812 2.6345 1.9881 3.5832 1.6252 7.0454 1.6252h24.236c2.4085-0.01263 4.3647 1.9419 4.3542 4.3504v26.293c0.004189 2.4065-1.9477 4.3583-4.3542 4.3541h-47.295c-2.405 0.002095-4.3546-1.9492-4.3504-4.3541v-30.296c-0.0041836-2.405 1.9454-4.3562 4.3504-4.3541z"
          fill="currentColor"
        />
        <path
          d="m8.3494 8.996h10.187c2.8349 0 2.9596 0.10961 5.8283 2.3812 2.6345 1.9881 3.5833 1.6252 7.0454 1.6252h24.236c2.4085-0.01263 4.3648 1.9419 4.3542 4.3504v26.293c0.0042 2.4065-1.9477 4.3583-4.3542 4.3541h-47.296c-2.405 0.0021-4.3546-1.9492-4.3505-4.3541v-30.296c-0.0042-2.405 1.9454-4.3562 4.3505-4.3541z"
          fill="#000000"
          opacity=".2"
        />
        <rect
          :style="{ color: folder.color }"
          x="3.9998"
          y="17.001"
          width="56"
          height="38"
          rx="4.3542"
          ry="4.2672"
          fill="currentColor"
        />
        <path
          d="m8.3528 17.001c-2.4114 0-4.3541 1.9012-4.3541 4.2634v1.0016c0-2.3623 1.9427-4.2672 4.3541-4.2672h47.294c2.4114 0 4.3541 1.9049 4.3541 4.2672v-1.0016c0-2.3623-1.9427-4.2634-4.3541-4.2634z"
          fill="#ffffff"
          opacity=".08"
        />
        <path
          d="m3.9986 49.737v0.99782c0 2.366 1.9427 4.2672 4.3541 4.2672h47.294c2.4114 0 4.3541-1.9012 4.3541-4.2672v-0.99782c0 2.3623-1.9427 4.2634-4.3541 4.2634h-47.294a4.3012 4.3012 0 0 1-4.3541-4.2634z"
          opacity=".15"
        />
        <path
          d="m8.3528 16c-2.4114 0-4.3541 1.9049-4.3541 4.2672v0.99782c0-2.3623 1.9427-4.2634 4.3541-4.2634h47.294c2.4114 0 4.3541 1.9012 4.3541 4.2634v-0.99782c0-2.3623-1.9427-4.2672-4.3541-4.2672z"
          opacity=".05"
        />
        <rect
          x="4"
          y="17"
          width="56"
          height="38"
          rx="4.3542"
          ry="4.2672"
          fill="url(#linearGradient946)"
          opacity=".2"
        />
      </svg>
    </div>

    <span class="row-name">{{ folder.folder_name }}</span>
    <span class="row-type">Carpeta</span>
    <span class="row-date">{{ folder.modified }}</span>

    <!-- Dots menu -->
    <button class="row-menu js-no-drag" @click.stop="$emit('menu', $event)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5"  r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="12" cy="19" r="1.8" />
      </svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  folder:   { type: Object,  required: true },
  selected: { type: Boolean, default: false },
})

defineEmits(['click', 'dblclick', 'contextmenu', 'menu'])
</script>

<style scoped>
.folder-row {
  background: var(--card, #fff);
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 8px);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  user-select: none;
  transition: background 160ms ease, border-color 160ms ease;
}

.folder-row:hover    { background: var(--surface, #faf8f5); border-color: var(--border, #e2ddd8); }
.folder-row.selected { border-color: var(--accent2, #5b7fa6); background: rgba(91,127,166,.06); }

/* Sortable states */
.folder-row.sortable-ghost  { opacity: .35; }
.folder-row.sortable-chosen { box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,.10)); }

.row-icon { flex-shrink: 0; }

.row-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text, #1c1814);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-type {
  font-size: 13px;
  color: var(--muted, #8a8078);
  width: 100px;
  flex-shrink: 0;
}

.row-date {
  font-size: 13px;
  color: var(--muted, #8a8078);
  width: 130px;
  flex-shrink: 0;
  text-align: right;
}

/* Dots menu */
.row-menu {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted, #8a8078);
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 160ms ease, background 160ms ease;
}

.folder-row:hover .row-menu  { opacity: 1; }
.row-menu:hover { background: var(--bg, #f0ede8); color: var(--text, #1c1814); }

/* Hide type/date on small screens */
@media (max-width: 768px) {
  .row-type, .row-date { display: none; }
}
</style>