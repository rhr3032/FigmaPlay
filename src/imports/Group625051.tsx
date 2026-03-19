import imgImage2 from "figma:asset/8a984b9e6abca0bb15173f5e519b58e71cdee2bf.png";

function Eyes() {
  return (
    <div className="h-[36.907px] relative w-[60.846px]" data-name="Eyes">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 60.8455 36.9065">
        <g id="Eyes">
          <circle cx="42.3922" cy="18.4532" fill="var(--fill-0, white)" id="Ellipse 19" r="17.9545" stroke="var(--stroke-0, #D8D8D8)" strokeWidth="0.997473" />
          <circle cx="50.8731" cy="18.9519" fill="var(--fill-0, black)" id="Ellipse 20" r="7.48105" stroke="var(--stroke-0, black)" strokeWidth="0.997473" />
          <circle cx="18.4532" cy="18.4532" fill="var(--fill-0, white)" id="Ellipse 18" r="17.9545" stroke="var(--stroke-0, #D8D8D8)" strokeWidth="0.997473" />
          <circle cx="23.9372" cy="14.962" fill="var(--fill-0, black)" id="Ellipse 21" r="7.48105" stroke="var(--stroke-0, black)" strokeWidth="0.997473" />
        </g>
      </svg>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[364.75px] top-[26.66px]">
      <div className="absolute flex h-[46.254px] items-center justify-center left-[364.75px] top-[26.66px] w-[66.01px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-[9.3deg]">
          <Eyes />
        </div>
      </div>
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents left-[324.5px] top-[15.66px]">
      <div className="absolute flex h-[200.179px] items-center justify-center left-[324.5px] top-[15.66px] w-[141.424px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-[-6.04deg]">
          <div className="h-[188.364px] relative w-[122.296px]" data-name="image 3">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img alt="" className="absolute h-[172.39%] left-[-0.38%] max-w-none top-[-36.57%] w-[472.03%]" src={imgImage2} />
            </div>
          </div>
        </div>
      </div>
      <Group1 />
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-0 top-0">
      <div className="absolute h-[134px] left-[465.5px] top-[57.66px] w-[318px]" data-name="image 2">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img alt="" className="absolute h-[172.39%] left-[-29.04%] max-w-none top-[-36.57%] w-[129.14%]" src={imgImage2} />
        </div>
      </div>
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[116px] left-0 not-italic text-[64px] text-black top-[57.66px]">Let’s</p>
      <p className="[text-decoration-skip-ink:none] absolute decoration-solid font-['Inter:Regular',sans-serif] font-normal leading-[116px] left-[161.75px] line-through not-italic opacity-20 text-[64px] text-black top-[57.66px]">Learn</p>
      <div className="absolute flex h-[134.363px] items-center justify-center left-[175.49px] top-0 w-[143.516px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-[-8.96deg]">
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[116px] not-italic relative text-[64px] text-black">Play</p>
        </div>
      </div>
      <Group3 />
    </div>
  );
}

export default function Group2() {
  return (
    <div className="relative size-full">
      <Group />
    </div>
  );
}