import Image from "next/image";
import type { CSSProperties } from "react";
import { PALETTES, type MiniPalette } from "./mini-site";

export type BlogPreview = {
  palette: MiniPalette;
  name: string;
  category: string;
  headline: string;
  excerpt: string;
  image: string;
  author: string;
  readTime: string;
  next: string;
};

/** Fictional publications illustrating what users can build. */
export function BlogSite({ post, host }: { post: BlogPreview; host: string }) {
  const p = PALETTES[post.palette];
  const style = { "--ms-bg": p.bg, "--ms-fg": p.fg, "--ms-ac": p.ac, "--ms-font": p.font, "--ms-w": p.weight } as CSSProperties;

  return (
    <div className="ms ms-blog lp-wall__site" style={style}>
      <div className="ms-chrome"><i /><i /><i /><span>{host}</span></div>
      <div className="ms-body">
        <div className="ms-blog__masthead"><b>{post.name}</b><span>Journal &nbsp; About</span></div>
        <Image className="ms-blog__photo" src={`/images/landing/${post.image}.jpg`} alt="" width={640} height={420} loading="eager" unoptimized />
        <p className="ms-blog__category">{post.category}</p>
        <h5>{post.headline}</h5>
        <p className="ms-blog__excerpt">{post.excerpt}</p>
        <div className="ms-blog__byline"><span>{post.author}</span><span>{post.readTime} read</span></div>
        <div className="ms-blog__next"><span>Up next</span><b>{post.next}</b><span>↗</span></div>
      </div>
    </div>
  );
}
