/** Composition registry. */
import React from "react";
import { Composition } from "remotion";
import { OdinLaunch } from "./Video";
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
  </>
);
