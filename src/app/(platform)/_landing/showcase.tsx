import { BlogSite } from "./blog-site";
import { SITES } from "./sites";

/** Endless row of example blogs. The list is rendered twice so the loop is seamless; the copy is hidden from assistive tech. */
export function Showcase({ rootDomain }: { rootDomain: string }) {
  const posts = SITES.flat();
  return (
    <div className="wb-marquee">
      <div className="wb-marquee__track">
        {[0, 1].map((copy) => (
          <div key={copy} className="wb-marquee__set" aria-hidden={copy === 1 || undefined}>
            {posts.map((post) => (
              <div key={post.name + post.headline} className="wb-marquee__item">
                <BlogSite post={post} host={`${post.name.toLowerCase().replace(/[^a-z]+/g, "")}.${rootDomain}`} />
                <p>{post.category}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
