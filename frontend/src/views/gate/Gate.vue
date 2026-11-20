<template>
  <!-- Cube 二开：门禁页。只提供密码输入（回车确认），无任何品牌/文字展示；
       浏览器页签标题与收藏图标与 cube 详情页一致（CubeAI + cubeai-logo.png）。 -->
  <div class="cube-gate">
    <input
      v-model="password"
      class="cube-gate-input"
      :class="{ 'cube-gate-input-error': failed }"
      type="password"
      autocomplete="off"
      autofocus
      @keyup.enter="submit"
    />
    <p v-if="failed" class="cube-gate-error">密码错误</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const password = ref('')
const failed = ref(false)

// 与路由守卫约定一致：sessionStorage 按标签页生效，关掉标签页即需重新过门禁
const GATE_FLAG_KEY = 'cubeGateOk'
const BASE_PAGE_TITLE = 'WeKnora'
const CUBE_PAGE_TITLE = 'CubeAI'
const CUBE_FAVICON_URL = `${import.meta.env.BASE_URL}cubeai-logo.png?favicon=1`

const getGateHash = (): string =>
  (window as unknown as { __RUNTIME_CONFIG__?: { CUBE_GATE_SHA256?: string } })
    .__RUNTIME_CONFIG__?.CUBE_GATE_SHA256 ?? ''

let originalFaviconHref: string | null = null
const applyCubeFavicon = (cube: boolean) => {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (originalFaviconHref === null) {
    originalFaviconHref = link.getAttribute('href')
  }
  link.setAttribute('href', cube ? CUBE_FAVICON_URL : (originalFaviconHref ?? '/favicon.ico'))
}

onMounted(() => {
  document.title = CUBE_PAGE_TITLE
  applyCubeFavicon(true)
  // 门禁未配置（CUBE_JBGSN 为空）或本标签页已通过 → 直接进登录页
  if (!getGateHash() || sessionStorage.getItem(GATE_FLAG_KEY) === '1') {
    router.replace({ path: '/login', hash: route.hash || undefined })
  }
})

onUnmounted(() => {
  document.title = BASE_PAGE_TITLE
  applyCubeFavicon(false)
})

const goLogin = () => {
  // 保留 query/hash：SSO/OIDC 回跳带的 oidc_result 不能因为过门禁而丢失
  router.replace({ path: '/login', query: route.query, hash: route.hash || undefined })
}

const submit = async () => {
  const gateHash = getGateHash()
  if (!gateHash) {
    goLogin()
    return
  }
  const inputHash = await sha256Hex(password.value)
  if (inputHash === gateHash) {
    sessionStorage.setItem(GATE_FLAG_KEY, '1')
    goLogin()
    return
  }
  failed.value = true
  password.value = ''
}

// SHA-256（hex）。生产站为 HTTPS 时走 WebCrypto；
// 纯 JS 兜底覆盖 http 内网访问（172.22.1.39:80 等非安全上下文无 crypto.subtle）。
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return sha256Pure(data)
}

function sha256Pure(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const l = bytes.length
  const padded = new Uint8Array(((l + 8) >> 6 << 6) + 64)
  padded.set(bytes)
  padded[l] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000))
  dv.setUint32(padded.length - 4, (l << 3) >>> 0)
  const w = new Uint32Array(64)
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }
  return Array.from(H).map((x) => x.toString(16).padStart(8, '0')).join('')
}
</script>

<style scoped>
.cube-gate {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cube-gate-input {
  width: 260px;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
}

.cube-gate-input:focus {
  border-color: #0052d9;
}

.cube-gate-input-error {
  border-color: #d54941;
}

.cube-gate-error {
  margin-top: 8px;
  font-size: 12px;
  color: #d54941;
}
</style>
