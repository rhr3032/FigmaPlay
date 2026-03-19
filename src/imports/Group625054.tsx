import svgPaths from "./svg-xhzc5pp43b";

function Eyes() {
  return (
    <div className="absolute h-[47.909px] left-[73px] top-[2.86px] w-[66.304px]" data-name="Eyes">
      <div className="absolute inset-[0_0_0_-0.75%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 66.804 47.9095">
          <g id="Eyes">
            <circle cx="43" cy="23.6451" fill="var(--fill-0, white)" id="Ellipse 19" r="18.5" stroke="var(--stroke-0, #D8D8D8)" />
            <circle cx="51.5" cy="24.1451" fill="var(--fill-0, black)" id="Ellipse 20" r="8" stroke="var(--stroke-0, black)" />
            <path d={svgPaths.p1b9dec00} fill="var(--fill-0, #FF1F1F)" id="Ellipse 355" />
            <circle cx="19" cy="23.6451" fill="var(--fill-0, white)" id="Ellipse 18" r="18.5" stroke="var(--stroke-0, #D8D8D8)" />
            <circle cx="23.5" cy="29.1451" fill="var(--fill-0, black)" id="Ellipse 21" r="8" stroke="var(--stroke-0, black)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default function Group() {
  return (
    <div className="relative size-full">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-none left-0 not-italic text-[#ff1f1f] text-[96px] top-[13px]">404</p>
      <Eyes />
      <div className="absolute flex h-[52.917px] items-center justify-center left-[65px] top-0 w-[52.655px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-30">
          <div className="h-[39px] relative w-[38.284px]">
            <div className="absolute bottom-1/2 left-0 right-0 top-0">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 38.2837 19.5">
                <path d={svgPaths.p25ee9f80} fill="var(--fill-0, #FF1F1F)" id="Ellipse 354" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}