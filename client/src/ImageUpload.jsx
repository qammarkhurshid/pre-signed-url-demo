import { useState } from 'react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const ImageUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const validateFile = (file) => {
    if (!file) return 'Please select a file.';
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 5MB limit.';
    }
    return null;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    setError(null);
    setUploadedImageUrl('');
    setProgress(0);
    
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        event.target.value = ''; // Reset file input
        return;
      }
      setSelectedFile(file);
    }
  };

  const getPresignedUrl = async (file) => {
    const response = await fetch('http://localhost:3000/get-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.statusText}`);
    }

    return response.json();
  };

  const uploadToS3 = async (url, file) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    });

    xhr.upload.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response());
        } else {
          // Enhanced error logging
          console.error('Upload failed:', {
            status: xhr.status,
            statusText: xhr.statusText,
            response: xhr.responseText
          });
          reject(new Error(`Upload failed with status: ${xhr.status}. Response: ${xhr.responseText}`));
        }
      }
    };

    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    // Don't set ACL header here - it should be in the presigned URL
    xhr.send(file);
  });
};

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Get presigned URL
      setUploadStatus('Getting upload URL...');
      const { uploadUrl, fileUrl } = await getPresignedUrl(selectedFile);

      // Upload to S3
      setUploadStatus('Uploading to S3...');
      await uploadToS3(uploadUrl, selectedFile);

      setUploadStatus('Upload successful!');
      setUploadedImageUrl(fileUrl);
    } catch (error) {
      const errorMessage = error?.message || 'An unexpected error occurred';
      setError(errorMessage);
      setUploadStatus('Upload failed');
      console.error('Error uploading file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <div className="space-y-4">
        {/* File Input */}
        <div>
          <label 
            htmlFor="file-upload" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Image
          </label>
          <input
            id="file-upload"
            type="file"
            accept={ALLOWED_FILE_TYPES.join(',')}
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={isLoading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Progress Bar */}
        {progress > 0 && progress < 100 && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isLoading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium
            ${!selectedFile || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}
            transition duration-150 ease-in-out`}
        >
          {isLoading ? 'Uploading...' : 'Upload Image'}
        </button>

        {/* Upload Status */}
        {uploadStatus && (
          <p className={`text-sm ${
            uploadStatus.includes('failed') 
              ? 'text-red-600' 
              : uploadStatus.includes('successful') 
                ? 'text-green-600' 
                : 'text-gray-600'
          }`}>
            {uploadStatus}
          </p>
        )}

        <p>{uploadedImageUrl}</p>
        {uploadedImageUrl && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Uploaded image:</p>
            <img 
              src={uploadedImageUrl} 
              alt="Uploaded" 
              className="w-full rounded-lg shadow-sm" 
              onError={() => setError('Failed to load uploaded image')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;