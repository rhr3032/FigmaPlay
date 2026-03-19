export default function Button() {
  return (
    <div className="bg-black content-stretch flex items-center justify-center px-[56px] py-[24px] relative rounded-[40px] size-full" data-name="button">
      <div aria-hidden="true" className="absolute border border-[#12da8a] border-solid inset-0 pointer-events-none rounded-[40px]" />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[32px] text-white">Play</p>
    </div>
  );
}