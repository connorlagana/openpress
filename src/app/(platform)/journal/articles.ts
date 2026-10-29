export const articles = [
  {
    slug: "learn-by-making", category: "Learning", title: "Learn by making something small.",
    description: "A reading tracker, one useful feature, and a few notes on what you learned. A post shaped from an AI conversation.",
    sections: [
      { title: "Start with something you want to use", body: "I had a familiar problem: I could finish a tutorial, but starting a project on my own felt different. Talking it through helped me find a smaller starting point. Instead of learning everything first, I could build something I actually wanted: a reading tracker with book titles and a few notes." },
      { title: "Make the first version almost too small", body: "The first version doesn’t need accounts, recommendations, or a beautiful dashboard. It needs one useful action: add a book and write a note. Keeping that scope small gives me a clear question to work on, and a way to recognize when I have something usable." },
      { title: "Let the attempt reveal the questions", body: "Once I try to build it, the next questions become more concrete. Where should a note be stored? What happens when I edit it? How can I find a book later? Those are questions I can explore with my AI while working on something that matters to me." },
      { title: "Keep a record, then share it", body: "After trying one feature, I can write down what worked, what confused me, and what I would change. That reflection is worth keeping. A question can become a plan, and that plan can become a post. With OpenPress connected, I can ask my AI to shape the discussion into a blog post and publish it through MCP." },
    ],
  },
  {
    slug: "bring-your-own-ai", category: "Guides", title: "Your favorite AI. A new superpower.",
    description: "What connecting your agent to OpenPress actually means, and how to start your first publishing conversation.",
    sections: [
      { title: "Give your agent a publishing connection", body: "An AI chat can help you write a post. Connecting it to OpenPress also gives it tools to manage the website where that post belongs. The connection uses MCP, a protocol through which an agent can discover tools and request actions. OpenPress supports remote MCP clients, including Claude, ChatGPT, and Cursor." },
      { title: "Connect, then choose access", body: "Start with the connection instructions for your client. Sign in to OpenPress and review the access requested by the agent. Permissions determine which operations it may perform and on which sites. You can revoke the connection later from your dashboard. OpenPress does not supply or bill you for the agent’s language model." },
      { title: "Make the first request concrete", body: "Try: ‘Create a journal about my weekend hikes. Use a calm editorial style, draft an introduction, and let me review it before publishing.’ A useful request includes a subject, an audience, and what should happen next. If you don’t know the design yet, ask the agent to suggest a direction." },
      { title: "Keep the conversation going", body: "Once the site exists, ask for a new post, a warmer palette, or a revision to the homepage. Hosting, generated SEO metadata, and private analytics are part of OpenPress. Your agent can work with those tools while you focus on what the site should say. For exact setup steps and supported tools, see the MCP documentation." },
    ],
  },
  {
    slug: "a-small-place-on-the-web", category: "Perspectives", title: "A small place on the web. Entirely yours.",
    description: "Start with one good page. Let it grow from there.",
    sections: [
      { title: "A website doesn’t need to be a launch", body: "Some of the most useful pages are modest: a record of experiments, a collection of recipes, or a clear explanation of what someone makes. They have a point of view and a reason to exist. They don’t need a content calendar on day one." },
      { title: "Choose a thread you want to follow", body: "Instead of planning twenty posts, choose one question you keep coming back to. Write what you know about it today. Share an example, a photograph, or a lesson from trying something. A small specific subject gives readers a better reason to return than a promise to cover everything." },
      { title: "Use the agent as a collaborator", body: "Ask your agent to organize your notes, suggest a structure, or turn a rough outline into a draft. Then review the details and keep the sentences that sound like you. Your experiences and judgment are the interesting part. The tool can help you get them onto a page." },
      { title: "Leave room to change your mind", body: "Publish one piece, see what you want to write next, and adjust the site as the idea develops. OpenPress lets you revise content and change structured theme settings without starting over. The aim is a place you can keep shaping, one conversation and one page at a time." },
    ],
  },
];
