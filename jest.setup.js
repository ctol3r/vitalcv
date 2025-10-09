"use client"

import "@testing-library/jest-dom"
import { jest } from "@jest/globals"
import { toHaveNoViolations } from "jest-axe"

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)

// Mock fetch globally
global.fetch = jest.fn()

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ""
  },
}))

jest.mock("react-dropzone", () => ({
  useDropzone: jest.fn(() => ({
    getRootProps: () => ({ role: "button" }),
    getInputProps: () => ({ role: "textbox", hidden: true }),
    isDragActive: false,
    fileRejections: [],
  })),
}))

global.URL.createObjectURL = jest.fn(() => "mocked-url")
global.URL.revokeObjectURL = jest.fn()

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
})

global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}))
