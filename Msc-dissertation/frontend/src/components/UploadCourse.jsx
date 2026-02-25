import React, { useState } from "react";

export default function UploadCourse() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setStatus("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus("Please select a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setStatus("Uploading...");
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setStatus(result.message || "✅ Upload successful!");
      } else {
        setStatus(result.error || "❌ Upload failed.");
      }
    } catch (error) {
      console.error("Error uploading:", error);
      setStatus("❌ Upload failed. Please try again.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow max-w-md mx-auto my-8">
      <h2 className="text-xl font-semibold mb-4">📄 Upload Training PDF</h2>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="mb-4 block w-full text-sm"
      />
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Summarise & Generate Course
      </button>
      {status && <p className="mt-4 text-sm text-gray-700">{status}</p>}
    </div>
  );
}
