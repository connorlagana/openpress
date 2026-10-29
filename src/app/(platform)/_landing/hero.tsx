import Link from "next/link";
import { ClaimName } from "./claim";

export function Hero({ appName, rootDomain, signedIn, banner }: { appName: string; rootDomain: string; signedIn: boolean; banner?: React.ReactNode }) {
  return (
    <section className="op-opening" aria-label="OpenPress journal">
      <div className="op-journal">
        <div className="op-journal__mast">
          <span className="op-eyebrow">THE OPENPRESS JOURNAL</span>
          <a href="#connect" className="op-journal__connect">Connect your AI ↗</a>
        </div>
        <div className="op-journal__lead">
          <div className="op-journal__copy">
            <div className="op-eyebrow op-green">FROM A CONVERSATION / FEATURED</div>
            <h1>Learn by making<br /><em>something small.</em></h1>
            <p>A question, a little back-and-forth, and an idea worth sharing. Turn the conversation you’re already having into a post on your blog.</p>
            <div className="op-byline"><b>OP</b><span>OpenPress editorial <span>Learning · 2 min read</span></span></div>
            <Link href="/journal/learn-by-making" className="op-text-link">Read the story <span>↗</span></Link>
          </div>
          <div className="op-art" aria-hidden="true">
            <div className="op-art__orbit op-art__orbit--one" /><div className="op-art__orbit op-art__orbit--two" />
            <span className="op-art__label">CONVERSATION → POST</span>
            <div className="op-art__sheet op-art__sheet--back" />
            <div className="op-art__sheet op-art__sheet--front"><span>OpenPress / 001</span><b>Start<br /><em>small.</em></b><div className="op-art__lines" /><small>One feature. One lesson. One post.</small><i>↗</i></div>
            <span className="op-art__foot">YOUR IDEAS. YOUR VOICE. YOUR BLOG.</span>
          </div>
        </div>
        <div className="op-journal__stories">
          <Link href="/journal/bring-your-own-ai"><span>01 / GUIDES</span><h2>Your favorite AI.<br />A new superpower.</h2><p>What connecting your agent actually means.</p><small>OpenPress editorial · 2 min read</small><span className="op-story-arrow">↗</span></Link>
          <Link href="/journal/a-small-place-on-the-web"><span>02 / PERSPECTIVES</span><h2>A small place on the web.<br />Entirely yours.</h2><p>Start with one good page. Let it grow from there.</p><small>OpenPress editorial · 2 min read</small><span className="op-story-arrow">↗</span></Link>
        </div>
        <div className="op-journal__claim">
          <div><span className="op-live"><i /> Your conversation doesn’t have to end in the chat.</span><h2>Connect your AI. Keep the ideas flowing.</h2><p>{appName} connects your AI to your blog through MCP.</p><a className="op-text-link" href="#connect">Connect your agent ↗</a>{banner}</div>
          {signedIn ? <Link href="/dashboard" className="lp-cta">Open dashboard →</Link> : <ClaimName rootDomain={rootDomain} signedIn={signedIn} />}
        </div>
      </div>
    </section>
  );
}
