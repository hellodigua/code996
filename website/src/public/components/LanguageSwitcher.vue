<template>
  <div class="language-switcher">
    <button @click="toggleLanguage" class="lang-button">
      {{ currentLanguageDisplay }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'

const { locale } = useI18n()
const router = useRouter()
const route = useRoute()

const currentLocale = computed(() => locale.value)

// 显示当前语言的文字
const currentLanguageDisplay = computed(() => {
  return currentLocale.value === 'zh-CN' ? '中' : 'EN'
})

// 切换语言 - 通过路由跳转
const toggleLanguage = () => {
  const currentPath = route.path
  const query = route.query

  if (currentLocale.value === 'zh-CN') {
    // 切换到英文
    if (currentPath.startsWith('/zh')) {
      const newPath = currentPath.replace('/zh', '/en')
      router.push({ path: newPath, query })
    }
  } else {
    // 切换到中文
    if (currentPath.startsWith('/en')) {
      const newPath = currentPath.replace('/en', '/zh')
      router.push({ path: newPath, query })
    }
  }
}
</script>

<style lang="scss" scoped>
.language-switcher {
  position: fixed;
  top: 20px;
  right: 100px; // 向左平移，避开GitHub图标(80px宽度 + 20px间距)
  z-index: 1000;

  .lang-button {
    display: inline-block;
    font-size: 14px;
    font-family:
      'Pixel',
      Helvetica Neue,
      Helvetica,
      PingFang SC,
      Hiragino Sans GB,
      Microsoft YaHei,
      Arial,
      sans-serif;
    cursor: pointer;
    padding: 8px 16px;
    background-color: #de335e;
    color: #fff;
    border: none;
    box-shadow:
      0px 0px 0px rgba(255, 255, 255, 0),
      6px 6px 0px rgba(0, 0, 0, 0.2);
    transition: 0.3s all;
    font-weight: bold;
    min-width: 40px;
    text-align: center;

    &:hover {
      background-color: #ef406c;
      box-shadow:
        0px 0px 0px rgb(255 255 255 / 0%),
        3px 3px 0px rgb(0 0 0 / 20%);
    }

    &:active {
      background-color: #c92a52;
      box-shadow:
        0px 0px 0px rgb(255 255 255 / 0%),
        2px 2px 0px rgb(0 0 0 / 20%);
      transform: translate(1px, 1px);
    }

    &:focus {
      outline: none;
    }
  }
}

@media (max-width: 768px) {
  .language-switcher {
    top: 10px;
    right: 90px; // 移动端也需要避开GitHub图标

    .lang-button {
      font-size: 12px;
      padding: 6px 12px;
      min-width: 32px;
      box-shadow:
        0px 0px 0px rgba(255, 255, 255, 0),
        4px 4px 0px rgba(0, 0, 0, 0.2);

      &:hover {
        box-shadow:
          0px 0px 0px rgb(255 255 255 / 0%),
          2px 2px 0px rgb(0 0 0 / 20%);
      }

      &:active {
        box-shadow:
          0px 0px 0px rgb(255 255 255 / 0%),
          1px 1px 0px rgb(0 0 0 / 20%);
      }
    }
  }
}
</style>
