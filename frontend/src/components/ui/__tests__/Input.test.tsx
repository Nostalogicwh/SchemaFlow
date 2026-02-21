import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '../Input'
import { Search } from 'lucide-react'

describe('Input', () => {
  describe('渲染测试', () => {
    it('renders input with placeholder', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('renders with default type text', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('renders with password type', () => {
      render(<Input type="password" />)
      const input = document.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })

    it('renders with number type', () => {
      render(<Input type="number" />)
      const input = document.querySelector('input[type="number"]')
      expect(input).toBeInTheDocument()
    })

    it('renders with email type', () => {
      render(<Input type="email" />)
      const input = document.querySelector('input[type="email"]')
      expect(input).toBeInTheDocument()
    })

    it('renders with prefix icon', () => {
      render(<Input prefixIcon={Search} placeholder="Search" />)
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
    })

    it('applies additional className', () => {
      render(<Input className="custom-class" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })
  })

  describe('输入事件测试', () => {
    it('handles input changes', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')
      
      fireEvent.change(input, { target: { value: 'hello' } })
      expect(handleChange).toHaveBeenCalled()
      expect(input).toHaveValue('hello')
    })

    it('works as controlled component', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('initial')
      
      rerender(<Input value="updated" onChange={() => {}} />)
      expect(input).toHaveValue('updated')
    })

    it('works as uncontrolled component', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      const input = screen.getByRole('textbox')
      
      // 非受控组件应该可以正常输入
      fireEvent.change(input, { target: { value: 'test' } })
      expect(handleChange).toHaveBeenCalled()
      expect(input).toHaveValue('test')
    })
  })

  describe('聚焦/失焦测试', () => {
    it('handles focus and blur events', () => {
      const handleFocus = vi.fn()
      const handleBlur = vi.fn()
      render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
      const input = screen.getByRole('textbox')
      
      fireEvent.focus(input)
      expect(handleFocus).toHaveBeenCalledTimes(1)
      
      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('can be focused', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      
      input.focus()
      expect(input).toHaveFocus()
    })
  })

  describe('错误态测试', () => {
    it('renders with error message', () => {
      render(<Input error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('shows error styles when error is provided', () => {
      render(<Input error="Error" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-red-500')
    })

    it('shows error styles when hasError is true', () => {
      render(<Input hasError />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-red-500')
    })

    it('does not show error message when only hasError is true', () => {
      render(<Input hasError />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('清除按钮测试', () => {
    it('shows clear button when clearable and has value', () => {
      render(<Input clearable value="test" onChange={() => {}} />)
      const clearButton = screen.getByLabelText('清除')
      expect(clearButton).toBeInTheDocument()
    })

    it('does not show clear button when value is empty', () => {
      render(<Input clearable value="" onChange={() => {}} />)
      expect(screen.queryByLabelText('清除')).not.toBeInTheDocument()
    })

    it('does not show clear button when disabled', () => {
      render(<Input clearable value="test" disabled onChange={() => {}} />)
      expect(screen.queryByLabelText('清除')).not.toBeInTheDocument()
    })

    it('clears value when clear button is clicked', () => {
      const handleChange = vi.fn()
      render(<Input clearable value="test" onChange={handleChange} />)
      
      const clearButton = screen.getByLabelText('清除')
      fireEvent.click(clearButton)
      
      expect(handleChange).toHaveBeenCalled()
      const eventArg = handleChange.mock.calls[0][0]
      expect(eventArg.target.value).toBe('')
    })

    it('works with uncontrolled component clear', () => {
      const handleChange = vi.fn()
      render(<Input clearable onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      
      // 先输入一些值
      fireEvent.change(input, { target: { value: 'test value' } })
      expect(input).toHaveValue('test value')
      
      // 点击清除按钮
      const clearButton = screen.getByLabelText('清除')
      fireEvent.click(clearButton)
      
      // 验证值被清除
      expect(input).toHaveValue('')
      expect(handleChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('禁用状态测试', () => {
    it('renders as disabled', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('shows disabled styles', () => {
      render(<Input disabled />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('bg-neutral-50', 'text-neutral-400', 'cursor-not-allowed')
    })

    it('does not accept input when disabled', () => {
      render(<Input disabled data-testid="disabled-input" />)
      const input = screen.getByTestId('disabled-input')
      
      // 验证 input 是 disabled 状态
      expect(input).toBeDisabled()
    })
  })

  describe('ref转发测试', () => {
    it('forwards ref correctly', () => {
      const ref = { current: null as HTMLInputElement | null }
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(ref.current?.tagName).toBe('INPUT')
    })

    it('ref can focus input', () => {
      const ref = { current: null as HTMLInputElement | null }
      render(<Input ref={ref} />)
      ref.current?.focus()
      expect(screen.getByRole('textbox')).toHaveFocus()
    })
  })
})
