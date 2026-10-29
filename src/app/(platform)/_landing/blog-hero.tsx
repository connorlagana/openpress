import Image from "next/image";
import Link from "next/link";
import { ClaimName } from "./claim";

/** Big centered promise, the name box, then a wide shot of a chat becoming a published post. */
export function BlogHero({ rootDomain, signedIn, banner }: { rootDomain: string; signedIn: boolean; banner?: React.ReactNode }) {
  return (
    <section className="wb-hero" aria-labelledby="hero-title">
      <div className="wb-hero__copy">
        {banner}
        <p className="wb-kicker">Free blog hosting · Free MCP server</p>
        <h1 id="hero-title">Create a blog from the conversations you already have</h1>
        <p className="wb-hero__lede">Talk things through with Claude, ChatGPT or any AI. When something&rsquo;s worth sharing, say &ldquo;make this a blog post&rdquo; and it&rsquo;s published on your own free blog.</p>
        <div className="wb-hero__cta">
          {signedIn ? (
            <Link href="/dashboard" className="lp-cta">
              Open dashboard <span className="lp-cta__arrow">→</span>
            </Link>
          ) : (
            <ClaimName rootDomain={rootDomain} signedIn={false} />
          )}
        </div>
      </div>
      <HeroShot host={`elsewhere.${rootDomain}`} />
    </section>
  );
}

function HeroShot({ host }: { host: string }) {
  return (
    <div className="wb-shot" aria-hidden>
      <div className="wb-shot__site">
        <div className="ms-chrome"><i /><i /><i /><span>{host}/lake-como</span></div>
        <div className="wb-shot__page">
          <div className="wb-shot__mast"><b>Elsewhere</b><span>Journal · Places · About</span></div>
          <Image className="wb-shot__photo" src="/images/landing/travel.jpg" alt="" width={1200} height={640} priority unoptimized />
          <div className="wb-shot__article">
            <p className="wb-shot__cat">The slow travel journal</p>
            <h2>Lake Como, without the crowds</h2>
            <p>Sleepy villages, lakeside swims, and the long way home. Everything we worked out about doing less in northern Italy.</p>
            <div className="wb-shot__lines"><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
      <div className="wb-chat">
        <div className="wb-chat__head"><span className="size-2 rounded-full bg-signal" /> Your AI chat</div>
        <p className="wb-chat__me">Thanks, this itinerary is perfect. Can you make our chat into a post for my travel blog?</p>
        <p className="wb-chat__ai">Sure. I&rsquo;ve written &ldquo;Lake Como, without the crowds&rdquo; with your photo and published it.</p>
        <p className="wb-chat__tool">✓ publish_post · live</p>
      </div>
    </div>
  );
}
