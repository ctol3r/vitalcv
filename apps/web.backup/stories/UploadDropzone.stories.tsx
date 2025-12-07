import type { Meta, StoryObj } from "@storybook/react"
import { UploadDropzone } from "@/components/ui/upload-dropzone"

const meta: Meta<typeof UploadDropzone> = {
  title: "Components/UploadDropzone",
  component: UploadDropzone,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onFilesChange: (files) => console.log("Files changed:", files),
  },
}

export const SingleFile: Story = {
  args: {
    maxFiles: 1,
    onFilesChange: (files) => console.log("Single file:", files),
  },
}

export const PDFOnly: Story = {
  args: {
    accept: {
      "application/pdf": [".pdf"],
    },
    onFilesChange: (files) => console.log("PDF files:", files),
  },
}

export const SmallSize: Story = {
  args: {
    maxSize: 1024 * 1024, // 1MB
    onFilesChange: (files) => console.log("Small files:", files),
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    onFilesChange: (files) => console.log("Disabled:", files),
  },
}

export const CustomClassName: Story = {
  args: {
    className: "max-w-md",
    onFilesChange: (files) => console.log("Custom class:", files),
  },
}
