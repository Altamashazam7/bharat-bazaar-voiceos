import { useState } from "react";
import { transcribeOrder } from "./api";

const AUDIO_BASE =
  "http://127.0.0.1:8000/audio";

function App() {
  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<any>(null);

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      const file =
        event.target.files?.[0];

      if (!file) return;

      setLoading(true);

      const data =
        await transcribeOrder(file);

      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="hero">
        <h1>Bharat Bazaar VoiceOS</h1>
        <p>
          AI-Powered Kirana Order Processing
        </p>

        <input
          type="file"
          accept=".wav,.mp3,.m4a"
          onChange={handleUpload}
        />
      </div>

      {loading && (
        <div className="card">
          <h2>Processing...</h2>
        </div>
      )}

      {result && (
        <>
          <div className="card">
            <h2>Transcript</h2>
            <p>{result.transcript}</p>
          </div>

          <div className="card">
            <h2>Commands</h2>

            <ul>
              {result.commands.map(
                (
                  command: string,
                  index: number
                ) => (
                  <li key={index}>
                    {command}
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="card">
            <h2>Cart</h2>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(
                  result.cart
                ).map(
                  ([product, qty]) => (
                    <tr key={product}>
                      <td>{product}</td>
                      <td>{String(qty)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Invoice</h2>

            <p>
              Total Items:
              {" "}
              {
                result.invoice
                  .total_items
              }
            </p>

            <pre>
              {result.invoice.text}
            </pre>
          </div>

          <div className="card">
            <h2>
              Confirmation
            </h2>

            <p>
              {
                result.confirmation_text
              }
            </p>
          </div>

          <div className="card">
            <h2>
              Play Confirmation
            </h2>

            <audio
              controls
              style={{
                width: "100%",
              }}
            >
              <source
                src={`${AUDIO_BASE}/confirmation.wav`}
                type="audio/wav"
              />
            </audio>
          </div>
        </>
      )}
    </div>
  );
}

export default App;