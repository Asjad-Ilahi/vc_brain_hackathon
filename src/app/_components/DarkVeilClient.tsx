"use client";
import dynamic from "next/dynamic";

const DarkVeil = dynamic(() => import("./DarkVeil"), { ssr: false });

type Props = {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  speed?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  resolutionScale?: number;
  style?: React.CSSProperties;
};

/**
 * Client-side wrapper for DarkVeil that handles the ssr:false dynamic import
 * so it can be used from Server Components.
 */
export default function DarkVeilClient(props: Props) {
  const { style, ...rest } = props;
  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      <DarkVeil {...rest} />
    </div>
  );
}
