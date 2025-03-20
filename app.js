import { db } from './config.js';
import { collection, doc, getDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Default avatar
const defaultAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

// Social media icons mapping
const socialIcons = {
    instagram: 'fab fa-instagram',
    twitter: 'fab fa-twitter',
    facebook: 'fab fa-facebook-f',
    linkedin: 'fab fa-linkedin-in',
    github: 'fab fa-github',
    youtube: 'fab fa-youtube',
    tiktok: 'fab fa-tiktok',
    snapchat: 'fab fa-snapchat',
    pinterest: 'fab fa-pinterest',
    reddit: 'fab fa-reddit-alien',
    whatsapp: 'fab fa-whatsapp',
    telegram: 'fab fa-telegram',
    email: 'fas fa-envelope'
};

// إضافة متغيرات للتحكم في الصفحات
let currentPage = 1;
const itemsPerPage = 8;
let totalLinks = 0;
let allLinks = [];

// Load profile data
async function loadProfile() {
    try {
        const docRef = doc(db, 'profile', 'main');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Update profile image
            const profileImage = document.getElementById('profile-image');
            if (profileImage) {
                profileImage.src = data.image || defaultAvatar;
                profileImage.onerror = () => {
                    profileImage.src = defaultAvatar;
                };
            }
            
            // Update profile info
            const nameElement = document.getElementById('profile-name');
            const bioElement = document.getElementById('profile-bio');
            
            if (nameElement) {
                nameElement.textContent = data.name || 'Your Name';
            }
            
            if (bioElement) {
                bioElement.textContent = data.bio || 'Your Bio';
            }
            
            // Update page title
            document.title = `${data.name || 'My Links'} - Connect With Me`;
            
            // Update online status
            const statusElement = document.getElementById('profile-status');
            if (statusElement) {
                if (data.status === 'online') {
                    statusElement.style.backgroundColor = '#4CAF50'; // Green for online
                } else if (data.status === 'away') {
                    statusElement.style.backgroundColor = '#FFC107'; // Yellow for away
                } else {
                    statusElement.style.backgroundColor = '#9E9E9E'; // Grey for offline
                }
            }
            
            // Load social icons if available
            if (data.social) {
                loadSocialIcons(data.social);
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Load social media icons
function loadSocialIcons(socialData) {
    const iconsContainer = document.getElementById('social-icons');
    if (!iconsContainer) return;
    
    iconsContainer.innerHTML = '';
    
    for (const [platform, url] of Object.entries(socialData)) {
        if (url && socialIcons[platform]) {
            const iconLink = document.createElement('a');
            iconLink.href = url;
            iconLink.className = 'social-icon';
            iconLink.target = '_blank';
            iconLink.rel = 'noopener noreferrer';
            iconLink.setAttribute('aria-label', platform);
            iconLink.innerHTML = `<i class="${socialIcons[platform]}"></i>`;
            iconsContainer.appendChild(iconLink);
        }
    }
}

// تحسين تجربة المستخدم على الأجهزة المحمولة
function setupMobileExperience() {
    // التعامل مع النقر على الروابط على الأجهزة المحمولة
    document.addEventListener('click', (e) => {
        const linkItem = e.target.closest('.link-item');
        if (linkItem) {
            linkItem.classList.add('active');
            setTimeout(() => {
                linkItem.classList.remove('active');
            }, 200);
        }
    });
    
    // تحسين تجربة التمرير
    if ('scrollBehavior' in document.documentElement.style === false) {
        // Polyfill for smooth scrolling for browsers that don't support it
        window.scrollToSmoothly = function(top) {
            const currentTop = window.pageYOffset || document.documentElement.scrollTop;
            const distance = top - currentTop;
            const duration = 300;
            let start = null;
            
            function step(timestamp) {
                if (!start) start = timestamp;
                const progress = timestamp - start;
                const percentage = Math.min(progress / duration, 1);
                const ease = easeInOutCubic(percentage);
                
                window.scrollTo(0, currentTop + distance * ease);
                
                if (progress < duration) {
                    window.requestAnimationFrame(step);
                }
            }
            
            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            }
            
            window.requestAnimationFrame(step);
        };
        
        // استبدال التمرير السلس الأصلي
        const originalScrollTo = window.scrollTo;
        window.scrollTo = function(options) {
            if (typeof options === 'object' && options.behavior === 'smooth' && options.top !== undefined) {
                window.scrollToSmoothly(options.top);
            } else {
                originalScrollTo.apply(window, arguments);
            }
        };
    }
    
    // تحسين تجربة اللمس
    document.addEventListener('touchstart', () => {}, {passive: true});
}

// تحسين تحميل الصور باستخدام lazy loading
function createLinkElement(link, index) {
    const linkElement = document.createElement('a');
    linkElement.href = link.url;
    linkElement.className = 'link-item';
    linkElement.style.setProperty('--i', index + 1);
    linkElement.target = '_blank';
    linkElement.rel = 'noopener noreferrer';
    
    // استخدام lazy loading للصور
    if (link.icon) {
        linkElement.innerHTML = `
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" 
                 data-src="${link.icon}" 
                 alt="${link.title}" 
                 loading="lazy"
                 class="lazy-image">
            <span>${link.title}</span>
            <div class="link-arrow"><i class="fas fa-chevron-right"></i></div>
        `;
    } else {
        linkElement.innerHTML = `
            <div style="width:60px;height:60px;margin-right:18px;"></div>
            <span>${link.title}</span>
            <div class="link-arrow"><i class="fas fa-chevron-right"></i></div>
        `;
    }
    
    return linkElement;
}

// إضافة دالة لتحميل الصور بشكل كسول
function lazyLoadImages() {
    const lazyImages = document.querySelectorAll('.lazy-image');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    image.src = image.dataset.src;
                    image.classList.remove('lazy-image');
                    imageObserver.unobserve(image);
                }
            });
        });
        
        lazyImages.forEach(image => {
            imageObserver.observe(image);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        lazyImages.forEach(image => {
            image.src = image.dataset.src;
        });
    }
}

// تعديل دالة loadLinks لدعم الصفحات
async function loadLinks() {
    const linksContainer = document.getElementById('links-container');
    if (!linksContainer) return;
    
    try {
        // تحميل جميع الروابط مرة واحدة وتخزينها
        if (allLinks.length === 0) {
            const q = query(collection(db, 'links'), orderBy('order', 'asc'));
            const querySnapshot = await getDocs(q);
            
            allLinks = [];
            querySnapshot.forEach((doc) => {
                allLinks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            totalLinks = allLinks.length;
        }
        
        // حساب الروابط التي سيتم عرضها في الصفحة الحالية
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalLinks);
        const linksToShow = allLinks.slice(startIndex, endIndex);
        
        // تفريغ الحاوية
        linksContainer.innerHTML = '';
        
        // إنشاء شظية لتحسين الأداء
        const fragment = document.createDocumentFragment();
        
        // إضافة الروابط للصفحة الحالية
        linksToShow.forEach((link, index) => {
            const linkElement = createLinkElement(link, index);
            fragment.appendChild(linkElement);
        });
        
        // إضافة الشظية إلى الحاوية
        linksContainer.appendChild(fragment);
        
        // تطبيق التحميل الكسول للصور
        lazyLoadImages();
        
        // إضافة تأثيرات حركية للروابط
        const linkItems = document.querySelectorAll('.link-item');
        linkItems.forEach((item, index) => {
            item.style.animationDelay = `${0.1 * (index + 1)}s`;
        });
        
        // تحديث أزرار التنقل بين الصفحات
        updatePagination();
    } catch (error) {
        console.error('Error loading links:', error);
    }
}

// دالة لتحديث أزرار التنقل بين الصفحات
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    // حساب عدد الصفحات
    const totalPages = Math.ceil(totalLinks / itemsPerPage);
    
    // لا داعي لعرض أزرار التنقل إذا كانت هناك صفحة واحدة فقط
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    // إظهار حاوية أزرار التنقل
    paginationContainer.style.display = 'flex';
    
    // إنشاء HTML لأزرار التنقل
    let paginationHTML = '';
    
    // زر الصفحة السابقة
    paginationHTML += `
        <button class="pagination-btn prev-btn ${currentPage === 1 ? 'disabled' : ''}" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // أزرار الصفحات
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // تعديل نطاق الصفحات المعروضة
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // إضافة زر الصفحة الأولى إذا لم تكن معروضة
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-btn page-btn" data-page="1">1</button>
            ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
        `;
    }
    
    // إضافة أزرار الصفحات
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn page-btn ${i === currentPage ? 'active' : ''}" 
                    data-page="${i}">${i}</button>
        `;
    }
    
    // إضافة زر الصفحة الأخيرة إذا لم تكن معروضة
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
            <button class="pagination-btn page-btn" data-page="${totalPages}">${totalPages}</button>
        `;
    }
    
    // زر الصفحة التالية
    paginationHTML += `
        <button class="pagination-btn next-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    // تحديث HTML
    paginationContainer.innerHTML = paginationHTML;
    
    // إضافة مستمعي الأحداث لأزرار التنقل
    const prevBtn = paginationContainer.querySelector('.prev-btn');
    const nextBtn = paginationContainer.querySelector('.next-btn');
    const pageButtons = paginationContainer.querySelectorAll('.page-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadLinks();
                // التمرير إلى أعلى الصفحة
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadLinks();
                // التمرير إلى أعلى الصفحة
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    pageButtons.forEach(button => {
        button.addEventListener('click', () => {
            const page = parseInt(button.getAttribute('data-page'));
            if (page !== currentPage) {
                currentPage = page;
                loadLinks();
                // التمرير إلى أعلى الصفحة
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

// Set current year in footer
function setCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// إضافة استدعاء الدالة في حدث DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // إعادة تعيين الصفحة الحالية عند تحميل الصفحة
    currentPage = 1;
    allLinks = [];
    
    // تحميل الملف الشخصي والروابط بالتوازي
    Promise.all([
        loadProfile(),
        loadLinks()
    ]).then(() => {
        // إخفاء شاشة التحميل
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
    });
    
    setCurrentYear();
    
    // إعداد تجربة الأجهزة المحمولة
    setupMobileExperience();
});

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
} 