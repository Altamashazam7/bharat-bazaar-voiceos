const API_BASE =
  "http://127.0.0.1:8000";

export async function transcribeOrder(
  file: File
) {
  const formData =
    new FormData();

  formData.append(
    "audio",
    file
  );

  const response =
    await fetch(
      `${API_BASE}/transcribe-order`,
      {
        method: "POST",
        body: formData,
      }
    );

  return response.json();
}