import { Composition } from "remotion";
import { OpenPressFilm } from "./Composition";

import { Kinetic } from "./alternatives/Kinetic";
import { Editorial } from "./alternatives/Editorial";
import { Conversation } from "./alternatives/Conversation";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="OpenPress"
      component={OpenPressFilm}
      durationInFrames={1200}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id="SayItShipIt"
      component={Kinetic}
      durationInFrames={1080}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id="SomewhereWorthSharing"
      component={Editorial}
      durationInFrames={1080}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id="MakeItMine"
      component={Conversation}
      durationInFrames={1080}
      fps={60}
      width={1920}
      height={1080}
    />
  </>
);
