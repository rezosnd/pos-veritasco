'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { uploadApi, getBackendUrl } from '@/lib/api';
import toast from 'react-hot-toast';

const BACKEND_URL = getBackendUrl();

/**
 * ImageUpload — drag-drop or click-to-upload with preview.
 * Props:
 *   value: current URL string
 *   onChange: (url) => void
 *   type: 'image' | 'logo' (default: 'image')
 *   label: optional label
 *   className: extra classes
 */
export default function ImageUpload({ value, onChange, type = 'image', label = 'Upload Image', className = '' }) {
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const previewUrl = value ? (value.startsWith('http') ? value : `${BACKEND_URL}${value}`) : null;

  const doUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');

    setUploading(true);
    try {
      const res = type === 'logo' ? await uploadApi.logo(file) : await uploadApi.image(file);
      onChange(res.data.url);
      toast.success('Image uploaded!');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    doUpload(e.dataTransfer.files[0]);
  };

  return (
    <div className={className}>
      {label && <label className="block text-xs text-[#a1a1aa] mb-2">{label}</label>}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden
          ${drag ? 'border-[var(--brand-color)] bg-[var(--brand-color)]/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}
          ${type === 'logo' ? 'h-32 w-32' : 'h-40 w-full'}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-xs font-medium">Click to change</p>
            </div>
            {!uploading && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(''); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center z-10 hover:bg-red-400">
                <X size={12} className="text-white" />
              </button>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#555] p-4">
            {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
            <p className="text-xs text-center">{uploading ? 'Uploading...' : 'Click or drag image here'}</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-white" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => doUpload(e.target.files[0])}
      />
    </div>
  );
}
