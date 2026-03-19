import svgPaths from "./svg-kptws7npje";

function Body() {
  return (
    <div className="absolute h-[189px] left-0 top-[18px] w-[126px]" data-name="Body">
      <div className="absolute inset-[-0.79%_-1.19%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 129 192">
          <g id="Body">
            <path d={svgPaths.p1d534800} id="Bottom left rounded rectangle" stroke="var(--stroke-0, black)" strokeWidth="3" />
            <path d={svgPaths.p1e8a7f00} fill="var(--fill-0, #FF7237)" id="Rectangle 29" stroke="var(--stroke-0, black)" strokeWidth="3" />
            <path d={svgPaths.p31b4900} id="Rectangle 30" stroke="var(--stroke-0, black)" strokeWidth="3" />
            <path d={svgPaths.p1bc24180} id="Rectangle 31" stroke="var(--stroke-0, black)" strokeWidth="3" />
            <rect height="63" id="Bottom right rounded rectangle" rx="31.5" stroke="var(--stroke-0, black)" strokeWidth="3" width="63" x="64.5" y="64.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Eyes() {
  return (
    <div className="absolute h-[37px] left-[54px] top-0 w-[61px]" data-name="Eyes">
      <div className="absolute inset-[-1.35%_-0.82%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 62 38">
          <g id="Eyes">
            <circle cx="43" cy="19" fill="var(--fill-0, white)" id="Ellipse 19" r="18.5" stroke="var(--stroke-0, #D8D8D8)" />
            <circle cx="51.5" cy="19.5" fill="var(--fill-0, black)" id="Ellipse 20" r="8" stroke="var(--stroke-0, black)" />
            <circle cx="19" cy="19" fill="var(--fill-0, white)" id="Ellipse 18" r="18.5" stroke="var(--stroke-0, #D8D8D8)" />
            <circle cx="24.5" cy="15.5" fill="var(--fill-0, black)" id="Ellipse 21" r="8" stroke="var(--stroke-0, black)" />
          </g>
        </svg>
      </div>
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