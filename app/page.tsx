import Office from "@/components/Office";

export default function Home() {
  return (
    <main className="stage">
      <Office />
      <div className="hud">
        <b>Pixel Office</b> — <b>double-click</b> to walk/sit · click <b>Edit Layout</b> to move &amp; resize objects
      </div>
    </main>
  );
}
