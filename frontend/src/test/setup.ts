import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 自动清理每个测试后的DOM
afterEach(() => {
  cleanup()
})
