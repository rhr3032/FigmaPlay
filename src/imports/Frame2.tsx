import imgRectangle29 from "figma:asset/f4bf4a9413812d4417c8551da65fe14987810c8a.png";
import imgRectangle30 from "figma:asset/25ef09832010fcf9a9eecf33cc6448aba545f0f9.png";
import imgRectangle31 from "figma:asset/75873e21b712231d5db6728451b539e001f3a5e3.png";

function Body() {
  return (
    <div className="absolute contents left-0 top-[18px]" data-name="Body">
      <div className="absolute bg-[rgba(255,55,55,0)] border border-black border-dashed left-0 rounded-bl-[41px] rounded-tl-[41px] size-[63px] top-[18px]" data-name="Bottom left rounded rectangle" />
      <div className="absolute left-[63px] size-[63px] top-[18px]">
        <img alt="" className="absolute block max-w-none size-full" height="63" src={imgRectangle29} width="63" />
      </div>
      <div className="absolute left-0 size-[63px] top-[81px]">
        <img alt="" className="absolute block max-w-none size-full" height="63" src={imgRectangle30} width="63" />
      </div>
      <div className="absolute left-0 size-[63px] top-[144px]">
        <img alt="" className="absolute block max-w-none size-full" height="63" src={imgRectangle31} width="63" />
      </div>
      <div className="absolute bg-[rgba(0,182,255,0)] border border-black border-dashed left-[63px] rounded-[41px] size-[63px] top-[81px]" data-name="Bottom right rounded rectangle" />
    </div>
  );
}

function Eyes() {
  return (
    <div className="absolute h-[37px] left-[54px] top-0 w-[61px]" data-name="Eyes">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 61 37">
        <g id="Eyes">
          <circle cx="42.5" cy="18.5" fill="var(--fill-0, white)" id="Ellipse 19" r="18" stroke="var(--stroke-0, #D8D8D8)" />
          <circle cx="51" cy="19" fill="var(--fill-0, black)" id="Ellipse 20" r="7.5" stroke="var(--stroke-0, black)" />
          <circle cx="18.5" cy="18.5" fill="var(--fill-0, white)" id="Ellipse 18" r="18" stroke="var(--stroke-0, #D8D8D8)" />
          <circle cx="24" cy="15" fill="var(--fill-0, black)" id="Ellipse 21" r="7.5" stroke="var(--stroke-0, black)" />
        </g>
      </svg>
    </div>
  );
}

function MainCharacterFig() {
  return (
    <div className="absolute contents left-0 top-0" data-name="MainCharacter-Fig">
      <Body />
      <Eyes />
    </div>
  );
}

export default function Frame() {
  return (
    <div className="relative size-full">
      <MainCharacterFig />
    </div>
  );
}