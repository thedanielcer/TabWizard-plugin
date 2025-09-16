import { Logger } from "@elgato/streamdeck";
import axios from "axios";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Size = {width: number, height: number};
type manualFaviconsOverridesType = {
    base64String: string,
    mtimeMs: number,
};

export class FaviconHandler{
    private logger!: Logger;
    private manualOverridesDirectory: string;
    private gitHubIconsDirectory: string;
    private MANUAL_FAVICONS_OVERRIDES = new Map<string, manualFaviconsOverridesType>();
    private FAVICONS_FOR_GITHUB = new Map<string, manualFaviconsOverridesType>();
    private SUPPORTED_EXTENSIONS = new Set ([".png", ".jpg", ".jpeg", ".webp"]);
    private faviconCache = new Map<string, manualFaviconsOverridesType>();

    constructor (logger: Logger, manualOverridesDirectory: string, gitHubIconsDirectory: string){
        this.logger = logger;
        this.manualOverridesDirectory = manualOverridesDirectory;
        this.gitHubIconsDirectory = gitHubIconsDirectory;
    }

    async init(): Promise<void> {
        await Promise.all([
          this.getFaviconsToOverride(this.manualOverridesDirectory, {width: 100, height: 100}),
          this.getFaviconsToOverride(this.gitHubIconsDirectory, {width: 100, height: 100}),
        ]);
      }

    async getFaviconsToOverride(
        directory: string,
        size: Size = {width: 100, height: 100},
    ){
        const allIconsFiles = await readdir(directory, {withFileTypes: true});

        await Promise.all(
            allIconsFiles.map(async (icon) => {
                if (!icon.isFile()) return;

                const extension = path.extname(icon.name).toLowerCase();

                if(!this.SUPPORTED_EXTENSIONS.has(extension)) return;

                const iconFileName = path.basename(icon.name, extension).toLowerCase();
                const absolutePath = path.join(directory, icon.name);
                const fileProperties = await stat(absolutePath);

                const imageMetadata = await sharp(absolutePath).metadata();
                const imageWidth = imageMetadata.width;
                const imageHeight = imageMetadata.height;

                let buffer: Buffer;

                if(imageWidth !== size.width || imageHeight !== size.height){
                    buffer = await sharp(absolutePath).resize(size.width, size.height, {
                        fit: "contain",
                        background: {r: 0, g: 0, b: 0, alpha: 0},
                    }).png().toBuffer();
                } else {
                    buffer = await sharp(absolutePath).toBuffer();
                }

                const faviconBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
                if (directory === this.manualOverridesDirectory){
                    this.MANUAL_FAVICONS_OVERRIDES.set(iconFileName, {mtimeMs: fileProperties.mtimeMs, base64String: faviconBase64});
                } else {
                    this.FAVICONS_FOR_GITHUB.set(iconFileName, {mtimeMs: fileProperties.mtimeMs, base64String: faviconBase64});
                }
            })
        );
    }

    async getFavicon(fullUrl: string): Promise<string>{
        try{
            // this.logger.debug(`getting favicon for ${fullUrl}`);
            const url = new URL(fullUrl);
            let domain = url.hostname.toLowerCase();
            if (domain.startsWith("www.")) domain = domain.slice(4);

            // this.logger.debug(`hostname: ${domain}`);
            if(domain === 'chatgpt.com') domain = 'chatgpt.co'

            if(fullUrl === 'edge://newtab/' && this.MANUAL_FAVICONS_OVERRIDES.has('new-tab')){
                const override = this.MANUAL_FAVICONS_OVERRIDES.get('new-tab');
                if (override) return override.base64String;
            }

            if(domain === 'github.com'){
                const repoName = this.extractGithubRepoName(fullUrl);
                if(!(this.FAVICONS_FOR_GITHUB.has(repoName))){
                    const gh = this.MANUAL_FAVICONS_OVERRIDES.get('github.com');
                    return gh ? gh.base64String : "";
                }
                const repoIcon = this.FAVICONS_FOR_GITHUB.get(repoName);
                if(repoIcon) return repoIcon.base64String;
            }

            if(this.MANUAL_FAVICONS_OVERRIDES.has(domain)){
                const mtimeMs = await this.getFaviconmtimeMs(domain);

                const override = this.MANUAL_FAVICONS_OVERRIDES.get(domain);
                if (override){
                    if (mtimeMs !== override.mtimeMs){
                        return await this.updateManualFaviconsOverrides(domain);
                    }
                    return override.base64String;
                }
                    
            }

            if(this.faviconCache.has(domain)){
                const cached = this.faviconCache.get(domain);
                if (cached) return cached.base64String;
            }

            this.logger.debug('making request for favicon for url ' + domain);

            const rawFavicon = await axios.get<ArrayBuffer>(
                `https://img.logo.dev/${domain}?token=pk_Gb5xYqzMT2KthP8ESZj36g&size=144&format=png&retina=true`,
                { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } }
            );

            const imageBuffer = Buffer.from(rawFavicon.data);
            const image = await sharp(imageBuffer).resize(100, 100, {
                fit: "contain",
                background: {r: 0, g: 0, b: 0, alpha: 0},
            }).png().toBuffer();

            const faviconBase64 = 'data:image/png;base64,' + image.toString("base64");

            this.faviconCache.set(domain, {mtimeMs: new Date().getTime(), base64String: faviconBase64});

            return faviconBase64;
        } catch (error) {
            return "";
        }
    }

    extractGithubRepoName(fullUrl: string): string{
        try{
            const { pathname } = new URL(fullUrl);
            const parts = pathname.split('/').filter(Boolean);
            return parts[1] ?? "JabaAI";
        } catch {
            return "";
        }
    }

    async getFaviconmtimeMs(domain: string): Promise<number>{
        try {
            const allIconsFiles = await readdir(this.manualOverridesDirectory, {withFileTypes: true});
            const matchingFile = allIconsFiles.find((file) => {
                if (!file.isFile()) return false;
                const fileNameWithoutExtension = this.filenameWithoutExtension(file.name).toLowerCase();
                return fileNameWithoutExtension === domain.toLowerCase();
            });
            if(!matchingFile){
                return 0;
            }

            const fileProperties = await stat(path.join(this.manualOverridesDirectory, matchingFile.name));
            return fileProperties.mtimeMs;
        } catch {
            return 0;
        }
    }

    async updateManualFaviconsOverrides(domain: string): Promise<string>{
        const allIconsFiles = await readdir(this.manualOverridesDirectory, {withFileTypes: true});

        const matchingFile = allIconsFiles.find((file) => {
            if (!file.isFile()) return false;
            const fileNameWithoutExtension = this.filenameWithoutExtension(file.name).toLowerCase();
            return fileNameWithoutExtension === domain.toLowerCase();
        });
        if(!matchingFile){
            return "";
        }

        const size = {width: 100, height: 100};

        const extension = path.extname(matchingFile.name).toLowerCase();

        if(!this.SUPPORTED_EXTENSIONS.has(extension)) return "";

        const iconFileName = path.basename(matchingFile.name, extension).toLowerCase();
        const absolutePath = path.join(this.manualOverridesDirectory, matchingFile.name);
        const fileProperties = await stat(absolutePath);

        const imageMetadata = await sharp(absolutePath).metadata();
        const imageWidth = imageMetadata.width;
        const imageHeight = imageMetadata.height;

        let buffer: Buffer;

        if(imageWidth !== size.width || imageHeight !== size.height){
            buffer = await sharp(absolutePath).resize(size.width, size.height, {
                fit: "contain",
                background: {r: 0, g: 0, b: 0, alpha: 0},
            }).png().toBuffer();
        } else {
            buffer = await sharp(absolutePath).toBuffer();
        }

        const faviconBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
        
        this.MANUAL_FAVICONS_OVERRIDES.set(iconFileName, {mtimeMs: fileProperties.mtimeMs, base64String: faviconBase64});

        return faviconBase64;
    }

    filenameWithoutExtension(filename: string): string{
        return path.basename(filename, path.extname(filename));
    }
}