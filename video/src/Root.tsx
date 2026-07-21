/** Composition registry. */
import React from "react";
import { Composition, Still } from "remotion";
import { OdinLaunch } from "./Video";
import { Standee } from "./Standee";
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from "./utils/timing";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="OdinLaunch"
      component={OdinLaunch}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* Roll-up standee · 85×200 cm proportions · ~101 DPI at print size */}
    <Still id="Standee" component={Standee} width={3400} height={8000} />
  </>
);
