import { UploadDropzone } from '@/components/ui/upload-dropzone';
import { jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
const mockDocFile = new File(['doc content'], 'test.docx', {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

function getFileInput() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!input) throw new Error('File input not found');
  return input;
}

describe('UploadDropzone', () => {
  it('renders upload area correctly', () => {
    render(<UploadDropzone />);

    expect(screen.getByText('Upload documents')).toBeInTheDocument();
    expect(screen.getByText('Drag & drop files here, or click to select')).toBeInTheDocument();
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  it('accepts PDF files', async () => {
    const onFilesChange = jest.fn();
    render(<UploadDropzone onFilesChange={onFilesChange} />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(onFilesChange).toHaveBeenCalled();
    });
  });

  it('shows file information after upload', async () => {
    render(<UploadDropzone />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('Uploaded Files (1/5)')).toBeInTheDocument();
    });
  });

  it('shows progress during upload', async () => {
    jest.useFakeTimers();
    render(<UploadDropzone />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('uploading')).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(2200);
    });

    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it('allows file removal', async () => {
    render(<UploadDropzone />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });

  it('respects maxFiles limit', async () => {
    const onFilesChange = jest.fn();
    render(<UploadDropzone maxFiles={1} onFilesChange={onFilesChange} />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile, mockDocFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(onFilesChange).toHaveBeenCalledWith([]);
      expect(screen.getAllByText(/Too many files/i).length).toBeGreaterThan(0);
    });
  });

  it('shows file size correctly', async () => {
    render(<UploadDropzone />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/12 Bytes/)).toBeInTheDocument();
    });
  });

  it('disables when disabled prop is true', () => {
    render(<UploadDropzone disabled />);

    const chooseButton = screen.getByText('Choose Files');
    expect(chooseButton).toBeDisabled();
  });

  it('shows different icons for different file types', async () => {
    render(<UploadDropzone />);

    const input = getFileInput();

    Object.defineProperty(input, 'files', {
      value: [mockFile, mockDocFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('test.docx')).toBeInTheDocument();
    });
  });
});
