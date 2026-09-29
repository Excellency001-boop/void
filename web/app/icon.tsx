import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08080a",
          border: "1px solid #26262c",
          color: "#3ecf8e",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "monospace",
        }}
      >
        V
      </div>
    ),
    size
  );
}
