import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const exhibitIds = [
  "entrance",
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "human-error",
  "gift-shop",
] as const;

const text = z.string().trim().min(1);
const href = z.url({ protocol: /^https$/ });

const exhibits = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/exhibits" }),
  schema: z.object({
    id: z.enum(exhibitIds),
    order: z.number().int().min(0).max(8),
    title: text,
    alt: text,
    dates: text,
    medium: text,
    accession: z.string().regex(/^MR\.\d{4}\.\d{3}$/),
    repo: text.optional(),
    links: z.array(z.object({ label: text, href })),
    touchLabel: text,
    touchResult: text,
    items: z
      .array(
        z.object({ label: text, href: href.optional(), note: text.optional() }),
      )
      .optional(),
    draft: z.boolean().default(true),
  }),
});

export const collections = { exhibits };
