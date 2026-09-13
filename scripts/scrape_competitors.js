import { chromium, firefox } from "playwright";
import { writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import path from "path";

// Configuración general
const SEARCH_QUERY = "asistentes fiscalidad contabilidad autonomos España gestoria online";
const MAX_COMPETITORS = 10;
const OUTPUT_REPORT_PATH = "./public/rrss/scrape_report.md";
const TEMP_SQL_PATH = "./temp_queries.sql";

// Filtro para excluir dominios irrelevantes o grandes plataformas
const EXCLUDED_DOMAINS = [
    "google.com", "youtube.com", "instagram.com", "linkedin.com", "twitter.com",
    "x.com", "facebook.com", "wikipedia.org", "expansion.com", "elconfidencial.com",
    "elmundo.es", "elpais.com", "cincodias.elpais.com", "emprendedores.es",
    "autonomosyemprendedor.es", "hacienda.gob.es", "boe.es", "github.com",
    "pinterest.com", "tiktok.com", "apple.com", "microsoft.com", "amazon.es",
    "sabi.es", "einforma.com", "libremercado.com"
];

function isCompetitorDomain(urlStr) {
    try {
        const url = new URL(urlStr);
        const host = url.hostname.toLowerCase();
        return !EXCLUDED_DOMAINS.some(domain => host.includes(domain));
    } catch {
        return false;
    }
}

async function run() {
    console.log(`[SCRAPER] Iniciando búsqueda de competidores en base a: "${SEARCH_QUERY}"`);
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
    });
    const page = await context.newPage();

    let competitorUrls = [];

    try {
        // 1. BÚSQUEDA EN GOOGLE
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(SEARCH_QUERY)}`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

        // Aceptar consentimiento de cookies si aparece
        const consentButtons = [
            "button:has-text('Aceptar todo')",
            "button:has-text('Aceptar')",
            "button:has-text('I agree')",
            "#L2AGLb"
        ];
        for (const selector of consentButtons) {
            try {
                if (await page.locator(selector).isVisible()) {
                    await page.click(selector);
                    console.log("[SCRAPER] Consentimiento de cookies de Google aceptado.");
                    await page.waitForTimeout(1000);
                    break;
                }
            } catch {}
        }

        // Extraer enlaces orgánicos
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll("a"));
            return anchors
                .map(a => a.href)
                .filter(href => href && href.startsWith("http"));
        });

        // Filtrar y dedup
        const uniqueLinks = Array.from(new Set(links));
        for (const link of uniqueLinks) {
            if (isCompetitorDomain(link)) {
                const url = new URL(link);
                const baseUrl = `${url.protocol}//${url.hostname}`;
                if (!competitorUrls.includes(baseUrl)) {
                    competitorUrls.push(baseUrl);
                }
            }
            if (competitorUrls.length >= MAX_COMPETITORS) break;
        }

        console.log(`[SCRAPER] Se localizaron ${competitorUrls.length} dominios de competidores en Google.`);
        console.log(competitorUrls);

    } catch (err) {
        console.error("[SCRAPER] Error durante la búsqueda en Google:", err.message);
    }

    const scrapedCompetitors = [];

    // 2. SCRAPING DE CADA COMPETIDOR
    for (const webUrl of competitorUrls) {
        console.log(`\n[SCRAPER] Raspando web: ${webUrl}`);
        const compPage = await context.newPage();
        
        let name = webUrl.replace(/^https?:\/\/(www\.)?/, "").split(".")[0];
        name = name.charAt(0).toUpperCase() + name.slice(1); // Capitalizar

        let webDesignNotes = "Diseño no determinado";
        let servicesOffered = "Servicios no determinados";
        let socialLinks = {
            linkedin: null,
            twitter: null,
            instagram: null,
            tiktok: null,
            youtube: null
        };

        try {
            await compPage.goto(webUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
            
            // Analizar diseño web y servicios de forma heurística (DOM)
            const pageText = await compPage.innerText("body").catch(() => "");
            const htmlContent = await compPage.content().catch(() => "");

            // Heurística de diseño
            const usesTailwind = htmlContent.includes("tailwind") || htmlContent.includes("tw-") ? "Tailwind CSS" : "CSS Tradicional";
            const usesReactOrNext = htmlContent.includes("__next") || htmlContent.includes("react") ? "React/Next.js" : "Estático / WordPress";
            const hasModernLayout = htmlContent.includes("flex") || htmlContent.includes("grid") ? "Disposición Moderna" : "Estilo básico";
            webDesignNotes = `Estructura: ${usesReactOrNext} con ${usesTailwind}. Diseño: ${hasModernLayout}.`;

            // Heurística de servicios
            const serviceKeywords = ["facturación", "impuestos", "autónomos", "contabilidad", "gestoría", "bancos", "conciliación", "fiscal"];
            const detectedServices = [];
            serviceKeywords.forEach(kw => {
                if (pageText.toLowerCase().includes(kw)) {
                    detectedServices.push(kw.charAt(0).toUpperCase() + kw.slice(1));
                }
            });
            servicesOffered = detectedServices.length > 0 ? detectedServices.join(", ") : "Servicios administrativos y contables";

            // Buscar enlaces a redes sociales
            const pageLinks = await compPage.evaluate(() => {
                return Array.from(document.querySelectorAll("a")).map(a => a.href);
            });

            pageLinks.forEach(link => {
                if (!link) return;
                const lowLink = link.toLowerCase();
                if (lowLink.includes("linkedin.com/company/") || lowLink.includes("linkedin.com/school/")) {
                    socialLinks.linkedin = link;
                } else if (lowLink.includes("twitter.com/") || lowLink.includes("x.com/")) {
                    if (!lowLink.includes("/share") && !lowLink.includes("/intent") && !lowLink.includes("/status")) {
                        socialLinks.twitter = link;
                    }
                } else if (lowLink.includes("instagram.com/")) {
                    socialLinks.instagram = link;
                } else if (lowLink.includes("tiktok.com/@")) {
                    socialLinks.tiktok = link;
                } else if (lowLink.includes("youtube.com/c/") || lowLink.includes("youtube.com/channel/") || lowLink.includes("youtube.com/@")) {
                    socialLinks.youtube = link;
                }
            });

            console.log(`[SCRAPER] Canales sociales detectados para ${name}:`, socialLinks);

        } catch (err) {
            console.error(`[SCRAPER] Error raspando web ${webUrl}:`, err.message);
        } finally {
            await compPage.close();
        }

        // 3. SCRAPING DE PERFILES DE REDES SOCIALES
        const metrics = {
            linkedin: { followers: null, posts: null, likes: null },
            twitter: { followers: null, posts: null, likes: null },
            instagram: { followers: null, posts: null, likes: null },
            tiktok: { followers: null, posts: null, likes: null },
            youtube: { followers: null, posts: null, likes: null }
        };

        // Scraping de Instagram (Meta parsing sin login es muy robusto)
        if (socialLinks.instagram) {
            try {
                const igPage = await context.newPage();
                await igPage.goto(socialLinks.instagram, { waitUntil: "domcontentloaded", timeout: 15000 });
                // Buscar la etiqueta meta description
                const metaDesc = await igPage.getAttribute("meta[name='description']", "content").catch(() => null);
                if (metaDesc) {
                    console.log(`[SCRAPER] Meta description de Instagram: ${metaDesc}`);
                    // Formato: "1,234 Followers, 567 Following, 89 Posts..."
                    const followersMatch = metaDesc.match(/([\d\.,KM]+)\s*Followers/i);
                    const postsMatch = metaDesc.match(/([\d\.,KM]+)\s*Posts/i);
                    
                    if (followersMatch) {
                        metrics.instagram.followers = parseAbbreviatedNumber(followersMatch[1]);
                    }
                    if (postsMatch) {
                        metrics.instagram.posts = parseAbbreviatedNumber(postsMatch[1]);
                    }
                }
                await igPage.close();
            } catch (err) {
                console.warn(`[SCRAPER] No se pudieron extraer métricas de Instagram para ${name}:`, err.message);
            }
        }

        // Scraping de TikTok
        if (socialLinks.tiktok) {
            try {
                const ttPage = await context.newPage();
                await ttPage.goto(socialLinks.tiktok, { waitUntil: "domcontentloaded", timeout: 15000 });
                
                // Intentar leer metadatos de TikTok
                const metaDesc = await ttPage.getAttribute("meta[name='description']", "content").catch(() => null);
                if (metaDesc) {
                    // Formato habitual de meta description en TikTok
                    const followersMatch = metaDesc.match(/([\d\.,KM]+)\s*seguidores/i) || metaDesc.match(/([\d\.,KM]+)\s*Followers/i);
                    const likesMatch = metaDesc.match(/([\d\.,KM]+)\s*me gusta/i) || metaDesc.match(/([\d\.,KM]+)\s*Likes/i);
                    if (followersMatch) {
                        metrics.tiktok.followers = parseAbbreviatedNumber(followersMatch[1]);
                    }
                    if (likesMatch) {
                        metrics.tiktok.likes = parseAbbreviatedNumber(likesMatch[1]);
                    }
                }
                await ttPage.close();
            } catch (err) {
                console.warn(`[SCRAPER] No se pudieron extraer métricas de TikTok para ${name}:`, err.message);
            }
        }

        // Scraping de YouTube
        if (socialLinks.youtube) {
            try {
                const ytPage = await context.newPage();
                await ytPage.goto(socialLinks.youtube, { waitUntil: "domcontentloaded", timeout: 15000 });
                // El título de YouTube o la descripción meta a veces contiene suscriptores
                const metaDesc = await ytPage.getAttribute("meta[name='description']", "content").catch(() => null);
                if (metaDesc) {
                    const subsMatch = metaDesc.match(/([\d\.,KM]+)\s*(suscriptores|subscribers)/i);
                    if (subsMatch) {
                        metrics.youtube.followers = parseAbbreviatedNumber(subsMatch[1]);
                    }
                }
                // Si no, buscar en la página el selector del recuento de suscriptores
                if (!metrics.youtube.followers) {
                    const text = await ytPage.innerText("body").catch(() => "");
                    const subsMatch = text.match(/([\d\.,KM\s]+)\s*(suscriptores|subscribers)/i);
                    if (subsMatch) {
                        metrics.youtube.followers = parseAbbreviatedNumber(subsMatch[1].trim());
                    }
                }
                await ytPage.close();
            } catch (err) {
                console.warn(`[SCRAPER] No se pudieron extraer métricas de YouTube para ${name}:`, err.message);
            }
        }

        // Para LinkedIn y Twitter/X, al requerir login riguroso, no inventamos datos
        // Quedarán marcados como null e informados
        console.log(`[SCRAPER] Métricas consolidadas para ${name}:`, metrics);

        scrapedCompetitors.push({
            name,
            webUrl,
            webDesignNotes,
            servicesOffered,
            socialLinks,
            metrics
        });
    }

    await browser.close();

    // 4. GUARDAR EN LA BASE DE DATOS D1 LOCAL
    console.log("\n[SCRAPER] Escribiendo sentencias SQL e insertando en base de datos D1 local...");
    let sqlQueries = "";
    
    // Primero, limpiar o actualizar marcas antiguas de competidores si ya existen,
    // o insertar si son nuevos
    scrapedCompetitors.forEach(comp => {
        // Sanitizar strings para evitar inyecciones SQL
        const cleanName = comp.name.replace(/'/g, "''");
        const cleanWebUrl = comp.webUrl.replace(/'/g, "''");
        const cleanDesign = comp.webDesignNotes.replace(/'/g, "''");
        const cleanServices = comp.servicesOffered.replace(/'/g, "''");
        const lLinkedin = comp.socialLinks.linkedin ? `'${comp.socialLinks.linkedin.replace(/'/g, "''")}'` : "NULL";
        const lTwitter = comp.socialLinks.twitter ? `'${comp.socialLinks.twitter.replace(/'/g, "''")}'` : "NULL";
        const lInstagram = comp.socialLinks.instagram ? `'${comp.socialLinks.instagram.replace(/'/g, "''")}'` : "NULL";
        const lTiktok = comp.socialLinks.tiktok ? `'${comp.socialLinks.tiktok.replace(/'/g, "''")}'` : "NULL";
        const lYoutube = comp.socialLinks.youtube ? `'${comp.socialLinks.youtube.replace(/'/g, "''")}'` : "NULL";

        const now = Math.floor(Date.now() / 1000);

        // Intentamos actualizar si ya existe por nombre o URL, si no insertar
        sqlQueries += `
-- Guardar datos de ${cleanName}
INSERT INTO rrss_competitors (
    name, web_url, type, target_audience, product, price,
    linkedin_url, instagram_url, tiktok_url, youtube_url,
    web_design_notes, services_offered,
    linkedin_followers, linkedin_posts, linkedin_likes,
    twitter_followers, twitter_posts, twitter_likes,
    instagram_followers, instagram_posts, instagram_likes,
    tiktok_followers, tiktok_posts, tiktok_likes,
    youtube_followers, youtube_posts, youtube_likes,
    scraped_at
) VALUES (
    '${cleanName}', '${cleanWebUrl}', 'directo', 'Autónomos y Pymes', 'Servicios de gestión', '€€',
    ${lLinkedin}, ${lInstagram}, ${lTiktok}, ${lYoutube},
    '${cleanDesign}', '${cleanServices}',
    ${comp.metrics.linkedin.followers ?? "NULL"}, ${comp.metrics.linkedin.posts ?? "NULL"}, ${comp.metrics.linkedin.likes ?? "NULL"},
    ${comp.metrics.twitter.followers ?? "NULL"}, ${comp.metrics.twitter.posts ?? "NULL"}, ${comp.metrics.twitter.likes ?? "NULL"},
    ${comp.metrics.instagram.followers ?? "NULL"}, ${comp.metrics.instagram.posts ?? "NULL"}, ${comp.metrics.instagram.likes ?? "NULL"},
    ${comp.metrics.tiktok.followers ?? "NULL"}, ${comp.metrics.tiktok.posts ?? "NULL"}, ${comp.metrics.tiktok.likes ?? "NULL"},
    ${comp.metrics.youtube.followers ?? "NULL"}, ${comp.metrics.youtube.posts ?? "NULL"}, ${comp.metrics.youtube.likes ?? "NULL"},
    ${now}
) ON CONFLICT(id) DO UPDATE SET
    web_url = '${cleanWebUrl}',
    linkedin_url = ${lLinkedin},
    instagram_url = ${lInstagram},
    tiktok_url = ${lTiktok},
    youtube_url = ${lYoutube},
    web_design_notes = '${cleanDesign}',
    services_offered = '${cleanServices}',
    linkedin_followers = ${comp.metrics.linkedin.followers ?? "NULL"},
    linkedin_posts = ${comp.metrics.linkedin.posts ?? "NULL"},
    linkedin_likes = ${comp.metrics.linkedin.likes ?? "NULL"},
    twitter_followers = ${comp.metrics.twitter.followers ?? "NULL"},
    twitter_posts = ${comp.metrics.twitter.posts ?? "NULL"},
    twitter_likes = ${comp.metrics.twitter.likes ?? "NULL"},
    instagram_followers = ${comp.metrics.instagram.followers ?? "NULL"},
    instagram_posts = ${comp.metrics.instagram.posts ?? "NULL"},
    instagram_likes = ${comp.metrics.instagram.likes ?? "NULL"},
    tiktok_followers = ${comp.metrics.tiktok.followers ?? "NULL"},
    tiktok_posts = ${comp.metrics.tiktok.posts ?? "NULL"},
    tiktok_likes = ${comp.metrics.tiktok.likes ?? "NULL"},
    youtube_followers = ${comp.metrics.youtube.followers ?? "NULL"},
    youtube_posts = ${comp.metrics.youtube.posts ?? "NULL"},
    youtube_likes = ${comp.metrics.youtube.likes ?? "NULL"},
    scraped_at = ${now};
`;
    });

    try {
        writeFileSync(TEMP_SQL_PATH, sqlQueries, "utf-8");
        const executionMode = process.env.CI ? '--remote' : '--local';
        execSync(`npx wrangler d1 execute alfonso-leads ${executionMode} --file=${TEMP_SQL_PATH}`, { stdio: "inherit" });
        console.log("[SCRAPER] Importación SQL finalizada con éxito.");
    } catch (dbErr) {
        console.error("[SCRAPER] Error ejecutando importación SQL en D1:", dbErr.message);
    } finally {
        try {
            unlinkSync(TEMP_SQL_PATH);
        } catch {}
    }

    // 5. GENERAR EL REPORTE MARKDOWN
    console.log("[SCRAPER] Generando archivo de reporte markdown...");
    let reportMd = `# Reporte de Scraping de Competidores (Firefox - Convencional)

**Fecha de Ejecución**: ${new Date().toLocaleString("es-ES")}
**Query de Búsqueda**: \`${SEARCH_QUERY}\`
**Límite de Competidores**: ${MAX_COMPETITORS}
**Tokens de LLM utilizados**: 0 (Raspado 100% puro/convencional)

---

## Competidores Localizados y Analizados

`;

    scrapedCompetitors.forEach((c, idx) => {
        reportMd += `### ${idx + 1}. ${c.name}
- **Sitio Web**: [${c.webUrl}](${c.webUrl})
- **Servicios Detectados**: ${c.servicesOffered}
- **Diseño de la Web**: ${c.webDesignNotes}

#### Canales Sociales Detectados & Métricas:
| Plataforma | URL Perfil | Seguidores / Suscriptores | Publicaciones | Likes (Me Gusta) | Estado Scraping |
|------------|------------|---------------------------|---------------|------------------|-----------------|
| **LinkedIn** | ${c.socialLinks.linkedin ? `[Ver Perfil](${c.socialLinks.linkedin})` : "*No detectado*"} | ${c.metrics.linkedin.followers ?? "*N/A*"} | ${c.metrics.linkedin.posts ?? "*N/A*"} | ${c.metrics.linkedin.likes ?? "*N/A*"} | ${c.socialLinks.linkedin ? "Bloqueado (Muro de login)" : "Sin enlace"} |
| **Twitter / X** | ${c.socialLinks.twitter ? `[Ver Perfil](${c.socialLinks.twitter})` : "*No detectado*"} | ${c.metrics.twitter.followers ?? "*N/A*"} | ${c.metrics.twitter.posts ?? "*N/A*"} | ${c.metrics.twitter.likes ?? "*N/A*"} | ${c.socialLinks.twitter ? "Bloqueado (Muro de login)" : "Sin enlace"} |
| **Instagram** | ${c.socialLinks.instagram ? `[Ver Perfil](${c.socialLinks.instagram})` : "*No detectado*"} | ${c.metrics.instagram.followers ?? "*N/A*"} | ${c.metrics.instagram.posts ?? "*N/A*"} | ${c.metrics.instagram.likes ?? "*N/A*"} | ${c.socialLinks.instagram ? "Éxito (Meta Parsing)" : "Sin enlace"} |
| **TikTok** | ${c.socialLinks.tiktok ? `[Ver Perfil](${c.socialLinks.tiktok})` : "*No detectado*"} | ${c.metrics.tiktok.followers ?? "*N/A*"} | ${c.metrics.tiktok.posts ?? "*N/A*"} | ${c.metrics.tiktok.likes ?? "*N/A*"} | ${c.socialLinks.tiktok ? "Éxito (Meta Parsing)" : "Sin enlace"} |
| **YouTube** | ${c.socialLinks.youtube ? `[Ver Canal](${c.socialLinks.youtube})` : "*No detectado*"} | ${c.metrics.youtube.followers ?? "*N/A*"} | ${c.metrics.youtube.posts ?? "*N/A*"} | ${c.metrics.youtube.likes ?? "*N/A*"} | ${c.socialLinks.youtube ? "Éxito (DOM Parsing)" : "Sin enlace"} |

---
`;
    });

    try {
        writeFileSync(OUTPUT_REPORT_PATH, reportMd, "utf-8");
        console.log(`[SCRAPER] Reporte markdown guardado en ${OUTPUT_REPORT_PATH}`);
    } catch (err) {
        console.error("[SCRAPER] Error escribiendo reporte markdown:", err.message);
    }

    console.log("[SCRAPER] Proceso de scraping finalizado.");
}

// Utilidad para convertir números tipo "1.2k" o "1,500" a número entero
function parseAbbreviatedNumber(numStr) {
    if (!numStr) return null;
    let clean = numStr.toLowerCase().replace(/[\s\.,]/g, "").trim();
    let multiplier = 1;
    if (clean.endsWith("k")) {
        multiplier = 1000;
        clean = clean.slice(0, -1);
    } else if (clean.endsWith("m")) {
        multiplier = 1000000;
        clean = clean.slice(0, -1);
    }
    const val = parseFloat(clean);
    return isNaN(val) ? null : Math.round(val * multiplier);
}

run();
