// ==UserScript==
// @name         ComicK Downloader
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Download manga chapters from ComicK with interface, organized by language
// @author       Elzents
// @match        https://comick.io*/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// ==/UserScript==

(async () => {
    'use strict';

    // user interface
    const ui = document.createElement('div');
    ui.style.position = 'fixed';
    ui.style.top = '20px';
    ui.style.right = '20px';
    ui.style.background = 'linear-gradient(145deg, #ffffff, #f0f0f0)';
    ui.style.border = 'none';
    ui.style.borderRadius = '12px';
    ui.style.padding = '20px';
    ui.style.zIndex = '10000';
    ui.style.maxWidth = '450px';
    ui.style.maxHeight = '90vh';
    ui.style.overflowY = 'auto';
    ui.style.fontFamily = '"Inter", -apple-system, sans-serif';
    ui.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    ui.style.transition = 'all 0.3s ease';

    ui.innerHTML = `
        <style>
            .ck-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
            }
            .ck-btn:hover {
                transform: translateY(-2px);
            }
            .ck-btn-primary {
                background: #6366f1;
                color: white;
            }
            .ck-btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            .ck-input {
                width: 100%;
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                margin: 8px 0;
            }
            .ck-progress {
                width: 100%;
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
            }
            .ck-progress-bar {
                height: 100%;
                background: #6366f1;
                width: 0;
                transition: width 0.3s ease;
            }
            .ck-section {
                margin: 15px 0;
                padding: 15px;
                background: rgba(243, 244, 246, 0.5);
                border-radius: 8px;
            }
            .ck-info-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: #6366f1;
                margin-left: 8px;
                font-size: 16px;
            }
            .ck-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                zIndex: 10001;
            }
            .ck-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                zIndex: 10000;
            }
            .ck-page-preview {
                display: flex;
                align-items: center;
                margin: 10px 0;
                padding: 10px;
                background: #f9fafb;
                border-radius: 6px;
            }
            .ck-page-preview img {
                max-width: 100px;
                max-height: 100px;
                margin-right: 10px;
                border-radius: 4px;
            }
        </style>
        <h3 style="margin: 0 0 15px; color: #1f2937; font-size: 1.5em;">ComicK Downloader</h3>
        <div class="ck-section">
            <label style="display: block; margin-bottom: 5px; color: #374151;">Search Manga:</label>
            <input type="text" id="searchInput" class="ck-input" placeholder="Enter manga title">
            <button id="searchBtn" class="ck-btn ck-btn-primary">Search</button>
        </div>
        <div id="searchResults" class="ck-section" style="display: none;"></div>
        <div id="langSelection" class="ck-section" style="display: none;">
            <label style="color: #374151;">Available Languages:</label>
            <div id="langCheckboxes" style="margin: 10px 0;"></div>
        </div>
        <div id="chapterSelection" class="ck-section" style="display: none;">
            <label style="color: #374151;">Select Chapters:</label>
            <div style="margin: 10px 0;">
                <label style="display: block; margin-bottom: 5px;">Select Range (Chapter Numbers):</label>
                <div style="display: flex; gap: 10px;">
                    <input type="number" id="rangeStart" class="ck-input" style="width: 100px;" placeholder="Start">
                    <input type="number" id="rangeEnd" class="ck-input" style="width: 100px;" placeholder="End">
                    <button id="applyRange" class="ck-btn ck-btn-secondary">Apply</button>
                </div>
            </div>
            <div id="chapterList" style="max-height: 250px; overflow-y: auto; margin: 10px 0;"></div>
            <div style="display: flex; gap: 10px;">
                <button id="selectAllChapters" class="ck-btn ck-btn-secondary">Select All</button>
                <button id="deselectAllChapters" class="ck-btn ck-btn-secondary">Deselect All</button>
            </div>
        </div>
        <div id="downloadSection" class="ck-section" style="display: none;">
            <button id="downloadBtn" class="ck-btn ck-btn-primary">Download Selected</button>
            <div class="ck-progress">
                <div id="progressBar" class="ck-progress-bar"></div>
            </div>
            <div id="downloadStatus" style="color: #374151; margin-top: 10px;"></div>
        </div>
    `;
    document.body.appendChild(ui);

    // Global variables
    let selectedManga = null;
    let allChapters = [];
    let selectedChapters = [];
    let filteredChapters = [];

    // Search manga
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');

    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        searchResults.style.display = 'block';
        if (!query) {
            searchResults.innerHTML = '<p style="color: #dc2626;">Please enter a title.</p>';
            return;
        }

        searchResults.innerHTML = '<p>Searching...</p>';
        try {
            const response = await fetch(`https://api.comick.io/v1.0/search?q=${encodeURIComponent(query)}&limit=10`, {
                headers: {
                    'Referer': location.href,
                    'Origin': location.origin,
                    'Accept': 'application/json',
                },
            });
            if (!response.ok) throw new Error('Search error');
            const mangas = await response.json();

            if (mangas.length === 0) {
                searchResults.innerHTML = '<p>No results found.</p>';
                return;
            }

            searchResults.innerHTML = mangas
                .map(
                    manga => `
                        <div style="padding: 10px; cursor: pointer; border-radius: 6px; background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; margin: 5px 0;"
                             onmouseover="this.style.background='#f3f4f6'"
                             onmouseout="this.style.background='#ffffff'"
                             data-hid="${manga.hid}"
                             data-title="${manga.title}">
                            ${manga.title}
                        </div>
                    `
                )
                .join('');
        } catch (e) {
            searchResults.innerHTML = `<p style="color: #dc2626;">Error: ${e.message}</p>`;
        }
    });

    // Select manga
    searchResults.addEventListener('click', async e => {
        const target = e.target.closest('div[data-hid]');
        if (!target) return;

        selectedManga = {
            hid: target.dataset.hid,
            title: target.dataset.title.replace(/[^a-zA-Z0-9]/g, '_'),
        };
        searchResults.innerHTML = `<p style="color: #374151;">Selected: ${target.dataset.title}</p>`;
        document.getElementById('langSelection').style.display = 'block';
        document.getElementById('chapterSelection').style.display = 'none';
        document.getElementById('downloadSection').style.display = 'none';

        // Fetch chapters
        allChapters = [];
        let page = 1;
        const limit = 100;

        while (true) {
            const url = `https://api.comick.io/comic/${selectedManga.hid}/chapters?page=${page}&limit=${limit}`;
            const res = await fetch(url, {
                headers: {
                    'Referer': location.href,
                    'Origin': location.origin,
                    'Accept': 'application/json',
                },
                credentials: 'include',
            });

            if (!res.ok) {
                searchResults.innerHTML += `<p style="color: #dc2626;">Error fetching chapters (page ${page}).</p>`;
                break;
            }

            const data = await res.json();
            const chapters = data.chapters || data;

            if (!chapters || chapters.length === 0) break;

            allChapters.push(...chapters);
            page++;
        }

        if (allChapters.length === 0) {
            searchResults.innerHTML += `<p style="color: #dc2626;">No chapters found.</p>`;
            return;
        }

        // Display available languages
        const languages = [...new Set(allChapters.map(ch => ch.lang))].sort();
        const langCheckboxes = document.getElementById('langCheckboxes');
        langCheckboxes.innerHTML = languages
            .map(
                lang => `
                    <label style="display: flex; align-items: center; margin: 8px 0; color: #374151;">
                        <input type="checkbox" value="${lang}" ${lang === 'fr' ? 'checked' : ''} style="margin-right: 8px;">
                        ${lang.toUpperCase()}
                    </label>
                `
            )
            .join('');

        updateChapterList();
        document.getElementById('chapterSelection').style.display = 'block';
        document.getElementById('downloadSection').style.display = 'block';
    });

    // Update chapter list
    function updateChapterList() {
        const selectedLangs = Array.from(document.querySelectorAll('#langCheckboxes input:checked')).map(
            input => input.value
        );
        filteredChapters = selectedLangs.length
            ? allChapters.filter(ch => selectedLangs.includes(ch.lang))
            : allChapters;

        // Sort chapters by chapter number
        filteredChapters.sort((a, b) => {
            const chapA = parseFloat(a.chap || '0');
            const chapB = parseFloat(b.chap || '0');
            return chapA - chapB;
        });

        const chapterList = document.getElementById('chapterList');
        chapterList.innerHTML = filteredChapters
            .map(
                (ch, i) => `
                    <label style="display: flex; align-items: center; margin: 8px 0; padding: 8px; background: white; border-radius: 6px; transition: background 0.2s;"
                           onmouseover="this.style.background='#f3f4f6'"
                           onmouseout="this.style.background='white'">
                        <input type="checkbox" value="${i}" style="margin-right: 8px;" data-chap="${ch.chap}">
                        <span style="color: #374151; flex-grow: 1;">
                            Vol. ${ch.vol || 'N/A'} Ch. ${ch.chap || 'N/A'} - ${ch.title || 'No title'} (${ch.lang})
                            ${ch.group_name?.length ? `[${ch.group_name.join(', ')}]` : ''}
                        </span>
                        <button class="ck-info-btn" data-hid="${ch.hid}" title="View chapter details">ℹ️</button>
                    </label>
                `
            )
            .join('');

        selectedChapters = [];
    }

    // Chapter selection and range selection
    document.getElementById('langCheckboxes').addEventListener('change', updateChapterList);

    document.getElementById('selectAllChapters').addEventListener('click', () => {
        document.querySelectorAll('#chapterList input').forEach(input => (input.checked = true));
    });

    document.getElementById('deselectAllChapters').addEventListener('click', () => {
        document.querySelectorAll('#chapterList input').forEach(input => (input.checked = false));
    });

    document.getElementById('applyRange').addEventListener('click', () => {
        const start = parseFloat(document.getElementById('rangeStart').value);
        const end = parseFloat(document.getElementById('rangeEnd').value);

        if (isNaN(start) || isNaN(end) || start > end) {
            document.getElementById('downloadStatus').innerHTML = '<p style="color: #dc2626;">Invalid range.</p>';
            return;
        }

        document.querySelectorAll('#chapterList input').forEach(input => {
            const chapNum = parseFloat(input.dataset.chap || '0');
            input.checked = chapNum >= start && chapNum <= end;
        });
    });

    // Get chapter pages
    async function getPagesFromChapter(chapterHID) {
        const url = `https://api.comick.io/chapter/${chapterHID}`;
        const res = await fetch(url, {
            headers: {
                'Referer': location.href,
                'Origin': location.origin,
                'Accept': 'application/json',
            },
            credentials: 'include',
        });

        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        return data.chapter.md_images.map((img, index) => ({
            url: `https://meo.comick.pictures/${img.b2key}`,
            name: `Page ${index + 1}`,
        }));
    }

    // Show chapter details
    document.getElementById('chapterList').addEventListener('click', async e => {
        const infoBtn = e.target.closest('.ck-info-btn');
        if (!infoBtn) return;

        const chapterHID = infoBtn.dataset.hid;
        const chapter = filteredChapters.find(ch => ch.hid === chapterHID);

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'ck-modal-overlay';
        document.body.appendChild(overlay);

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'ck-modal';
        modal.innerHTML = `
            <h3 style="margin: 0 0 15px; color: #1f2937;">Chapter Details: Ch. ${chapter.chap || 'N/A'} (${chapter.lang})</h3>
            <div id="pageList">Loading pages...</div>
            <button class="ck-btn ck-btn-secondary" style="margin-top: 15px;">Close</button>
        `;
        document.body.appendChild(modal);

        // Fetch and display pages
        const pages = await getPagesFromChapter(chapterHID);
        const pageList = modal.querySelector('#pageList');
        if (pages.length === 0) {
            pageList.innerHTML = '<p style="color: #dc2626;">No pages found.</p>';
        } else {
            pageList.innerHTML = pages
                .map(
                    page => `
                        <div class="ck-page-preview">
                            <img src="${page.url}" alt="Page preview" loading="lazy">
                            <span style="color: #374151;">${page.name}</span>
                        </div>
                    `
                )
                .join('');
        }

        // Close modal
        modal.querySelector('button').addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        });
        overlay.addEventListener('click', () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        });
    });

    // Download with progress and concurrent fetching
    document.getElementById('downloadBtn').addEventListener('click', async () => {
        const downloadStatus = document.getElementById('downloadStatus');
        const progressBar = document.getElementById('progressBar');

        downloadStatus.innerHTML = '<p>Preparing download...</p>';
        progressBar.style.width = '0%';

        selectedChapters = Array.from(document.querySelectorAll('#chapterList input:checked')).map(
            input => filteredChapters[parseInt(input.value)]
        );

        if (selectedChapters.length === 0) {
            downloadStatus.innerHTML = '<p style="color: #dc2626;">Please select at least one chapter.</p>';
            return;
        }

        const zip = new JSZip();
        const mainFolder = zip.folder(selectedManga.title);
        let totalPages = 0;
        let downloadedPages = 0;

        // Calculate total pages for progress
        for (const chapter of selectedChapters) {
            const pages = await getPagesFromChapter(chapter.hid);
            totalPages += pages.length;
        }

        const BATCH_SIZE = 5; // Number of images to fetch concurrently

        // Group chapters by language
        const chaptersByLang = {};
        selectedChapters.forEach(chapter => {
            if (!chaptersByLang[chapter.lang]) {
                chaptersByLang[chapter.lang] = [];
            }
            chaptersByLang[chapter.lang].push(chapter);
        });

        // Process each language
        for (const lang in chaptersByLang) {
            const langFolder = mainFolder.folder(lang.toUpperCase());
            const chapters = chaptersByLang[lang];

            for (const chapter of chapters) {
                downloadStatus.innerHTML = `<p>Downloading: Vol. ${chapter.vol || 'N/A'} Ch. ${
                    chapter.chap || 'N/A'
                } (${chapter.lang})</p>`;

                const pages = await getPagesFromChapter(chapter.hid);
                if (pages.length === 0) {
                    downloadStatus.innerHTML += `<p style="color: #f59e0b;">No pages found for this chapter.</p>`;
                    continue;
                }

                const chapterFolder = langFolder.folder(`Chapitre ${chapter.chap || 'N/A'}`);

                // Process pages in batches
                for (let i = 0; i < pages.length; i += BATCH_SIZE) {
                    const batch = pages.slice(i, i + BATCH_SIZE).map(async (page, index) => {
                        try {
                            const res = await fetch(page.url, {
                                headers: { Referer: location.href },
                            });
                            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
                            const blob = await res.blob();
                            return { blob, index: i + index };
                        } catch (e) {
                            downloadStatus.innerHTML += `<p style="color: #dc2626;">Error page ${i + index + 1}: ${e.message}</p>`;
                            return null;
                        }
                    });

                    const results = await Promise.all(batch);
                    results.forEach(result => {
                        if (result) {
                            chapterFolder.file(`${String(result.index + 1).padStart(1, '0')}.jpg`, result.blob);
                            downloadedPages++;
                            const progress = (downloadedPages / totalPages) * 100;
                            progressBar.style.width = `${progress}%`;
                        }
                    });
                }
            }
        }

        downloadStatus.innerHTML = '<p>Generating ZIP...</p>';
        progressBar.style.width = '100%';

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedManga.title}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        downloadStatus.innerHTML = '<p style="color: #16a34a;">Download complete!</p>';
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 2000);
    });
})();
