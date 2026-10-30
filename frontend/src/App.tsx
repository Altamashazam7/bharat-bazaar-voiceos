import { useState } from "react";
import { transcribeOrder } from "./api";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      const file = event.target.files?.[0];

      if (!file) return;

      setLoading(true);

      const data =
        await transcribeOrder(file);

      console.log(data);

      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      <h1>Bharat Bazaar VoiceOS</h1>

      <input
        type="file"
        accept=".wav,.mp3,.m4a"
        onChange={handleUpload}
      />

      {loading && (
        <h2>Processing...</h2>
      )}

      {result && (
        <>
          <h2>Transcript</h2>
          <pre>
            {result.transcript}
          </pre>

          <h2>Commands</h2>
          <pre>
            {JSON.stringify(
              result.commands,
              null,
              2
            )}
          </pre>

          <h2>Cart</h2>
          <pre>
            {JSON.stringify(
              result.cart,
              null,
              2
            )}
          </pre>

          <h2>Invoice</h2>
          <pre>
            {result.invoice?.text}
          </pre>

          <h2>Confirmation</h2>
          <pre>
            {result.confirmation_text}
          </pre>

          <h2>Audio</h2>
          <pre>
            {result.confirmation_audio}
          </pre>
        </>
      )}
    </div>
  );
}

export default App;