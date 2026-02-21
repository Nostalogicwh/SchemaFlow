# 测试框架使用说明

## 已配置的工具

- **Vitest** - 测试运行器
- **@testing-library/react** - React 组件测试工具
- **@testing-library/jest-dom** - DOM 断言扩展
- **jsdom** - 浏览器环境模拟

## 可用命令

```bash
# 运行所有测试（单次）
npm test -- --run

# 运行测试（监视模式）
npm test

# 运行特定文件测试
npm test -- --run Button.test.tsx

# 运行带UI的测试
npm run test:ui

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 项目结构

```
frontend/
├── vitest.config.ts          # Vitest 配置文件
├── src/
│   ├── test/
│   │   └── setup.ts          # 测试环境初始化
│   └── components/
│       └── ui/
│           └── __tests__/    # UI 组件测试目录
│               ├── Button.test.tsx
│               ├── Input.test.tsx
│               └── Modal.test.tsx
```

## 测试覆盖的组件

### Button 组件 (18 个测试)
- 渲染测试：各变体（primary/secondary/danger/ghost）、各尺寸（sm/md/lg）
- 交互测试：点击事件、disabled 状态
- 加载状态测试：loading spinner、disabled 行为
- 图标测试：带图标按钮、纯图标按钮
- Ref 转发测试

### Input 组件 (26 个测试)
- 渲染测试：placeholder、各类型（text/password/number/email）、前缀图标
- 输入事件测试：change 事件、受控/非受控模式
- 聚焦/失焦测试：focus/blur 事件
- 错误态测试：错误消息、错误样式
- 清除按钮测试：显示逻辑、点击行为
- 禁用状态测试：disabled 属性、样式
- Ref 转发测试

### Modal 组件 (22 个测试)
- 渲染测试：打开/关闭状态、标题、底部、各尺寸
- 关闭功能测试：关闭按钮、遮罩点击、closeOnOverlayClick
- 键盘交互测试：ESC 键关闭、事件监听清理
- 焦点管理测试：aria 属性、tabIndex
- 背景滚动锁定测试：body overflow 管理
- 焦点捕获测试：焦点在 modal 内循环

## 编写新测试

参考现有测试文件结构：

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { YourComponent } from '../YourComponent'

describe('YourComponent', () => {
  it('does something', () => {
    render(<YourComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

## 注意事项

1. 每个测试文件会自动导入 `setup.ts` 中的配置
2. 测试后 DOM 会自动清理（通过 cleanup）
3. 使用 `screen.getByRole()` 优先于 `screen.getByTestId()`
4. 测试 Tailwind 类名时使用实际应用的类名（注意空格和换行）
