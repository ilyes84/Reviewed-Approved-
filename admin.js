import { auth, db, imgbbApiKey } from './config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    getDocs, 
    setDoc, 
    orderBy, 
    query,
    getDoc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// التحقق من تسجيل الدخول
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// التحقق من الصورة قبل الرفع
async function validateAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        // التحقق من نوع الملف
        if (!file.type.match(/image.*/)) {
            reject(new Error('Please select a valid image file'));
            return;
        }

        // التحقق من حجم الملف (أقل من 2MB)
        if (file.size > 2 * 1024 * 1024) {
            reject(new Error('Image size should be less than 2MB'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // تقليل حجم الصورة إذا كانت كبيرة جداً
                if (width > 400 || height > 400) {
                    if (width > height) {
                        height = Math.round((height * 400) / width);
                        width = 400;
                    } else {
                        width = Math.round((width * 400) / height);
                        height = 400;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // تحويل الصورة إلى WebP بجودة 0.7 للضغط الأفضل
                try {
                    const resizedImage = canvas.toDataURL('image/webp', 0.7);
                    resolve(resizedImage.split(',')[1]);
                } catch (e) {
                    // إذا لم يدعم المتصفح WebP، استخدم JPEG
                    const resizedImage = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(resizedImage.split(',')[1]);
                }
            };
            img.onerror = () => reject(new Error('Failed to process image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
    });
}

// تحسين وظيفة رفع الصور لضغط الصور بشكل أفضل
async function uploadToImgBB(file) {
    try {
        // إظهار مؤشر التحميل
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div><p>جاري رفع الصورة...</p>';
        document.body.appendChild(loadingIndicator);
        
        // معالجة الصورة قبل الرفع
        const base64string = await validateAndResizeImage(file);
        
        const formData = new FormData();
        formData.append('key', imgbbApiKey);
        formData.append('image', base64string);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        // إزالة مؤشر التحميل
        loadingIndicator.remove();

        if (!response.ok) {
            throw new Error('فشل رفع الصورة');
        }

        const data = await response.json();

        if (data.success) {
            // التحقق من صحة الرابط
            await testImageUrl(data.data.display_url);
            return data.data.display_url;
        } else {
            throw new Error(data.error?.message || 'فشل رفع الصورة');
        }
    } catch (error) {
        // إزالة مؤشر التحميل في حالة حدوث خطأ
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        console.error('خطأ في رفع الصورة:', error);
        alert('حدث خطأ أثناء رفع الصورة: ' + error.message);
        throw error;
    }
}

// دالة لاختبار رابط الصورة
async function testImageUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('فشل تحميل الصورة من الرابط المُرجع'));
        img.src = url;
        
        // تعيين مهلة زمنية للتحميل
        setTimeout(() => reject(new Error('انتهت مهلة تحميل الصورة')), 10000);
    });
}

// تحديث معاينة الصورة
function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (input && preview) {
        input.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    // التحقق من الصورة قبل المعاينة
                    const base64string = await validateAndResizeImage(file);
                    preview.src = `data:image/jpeg;base64,${base64string}`;
                    preview.style.display = 'block';
                } catch (error) {
                    alert(error.message);
                    input.value = ''; // مسح اختيار الملف
                    preview.style.display = 'none';
                }
            }
        });
    }
}

// تحديث دالة تحديث الملف الشخصي لتفريغ الحقول بعد التعديل
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name-input')?.value || '';
    const bio = document.getElementById('bio-input')?.value || '';
    const status = document.getElementById('profile-status')?.value || 'online';
    const imageFile = document.getElementById('profile-image-input')?.files[0];
    
    try {
        // إظهار مؤشر التحميل
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div><p>جاري حفظ البيانات...</p>';
        document.body.appendChild(loadingIndicator);
        
        let imageUrl = '';
        if (imageFile) {
            imageUrl = await uploadToImgBB(imageFile);
        }
        
        // جمع بيانات وسائل التواصل الاجتماعي
        const socialInputs = document.querySelectorAll('.social-input');
        const social = {};
        
        socialInputs.forEach(input => {
            const platform = input.getAttribute('data-platform');
            const value = input.value.trim();
            if (platform && value) {
                social[platform] = value;
            }
        });
        
        // تحديث البيانات في Firestore
        const profileData = {
            name,
            bio,
            status,
            social
        };
        
        // إضافة الصورة فقط إذا تم تحميل صورة جديدة
        if (imageUrl) {
            profileData.image = imageUrl;
        }
        
        await setDoc(doc(db, 'profile', 'main'), profileData, { merge: true });
        
        // إزالة مؤشر التحميل
        loadingIndicator.remove();
        
        // إعادة تعيين النموذج
        resetProfileForm();
        
        alert('Profile updated successfully!');
    } catch (error) {
        // إزالة مؤشر التحميل في حالة حدوث خطأ
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        console.error('Error updating profile:', error);
        alert('Error: ' + error.message);
    }
});

// دالة لإعادة تعيين نموذج الملف الشخصي
function resetProfileForm() {
    // إعادة تعيين النموذج
    const form = document.getElementById('profile-form');
    if (form) form.reset();
    
    // إخفاء معاينة الصورة
    const preview = document.getElementById('profile-image-preview');
    if (preview) {
        preview.style.display = 'none';
    }
    
    // إعادة تعيين حقل الصورة بشكل صريح
    const imageInput = document.getElementById('profile-image-input');
    if (imageInput) {
        // إنشاء نسخة جديدة من حقل الإدخال لتفريغه تماماً
        const newInput = document.createElement('input');
        newInput.type = 'file';
        newInput.id = 'profile-image-input';
        newInput.name = 'profile-image';
        newInput.accept = 'image/*';
        
        // استبدال حقل الإدخال القديم بالجديد
        imageInput.parentNode.replaceChild(newInput, imageInput);
        
        // إعادة إعداد معاينة الصورة للحقل الجديد
        setupImagePreview('profile-image-input', 'profile-image-preview');
    }
    
    // تحميل البيانات الحالية للملف الشخصي
    loadProfileData();
}

// دالة لتحميل بيانات الملف الشخصي الحالية
async function loadProfileData() {
    try {
        const docRef = doc(db, 'profile', 'main');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // ملء حقول النموذج بالبيانات الحالية - تحديث أسماء العناصر
            const nameInput = document.getElementById('name-input');
            const bioInput = document.getElementById('bio-input');
            const statusInput = document.getElementById('profile-status');
            
            if (nameInput) nameInput.value = data.name || '';
            if (bioInput) bioInput.value = data.bio || '';
            if (statusInput) statusInput.value = data.status || 'online';
            
            // عرض الصورة الحالية
            const currentImageElement = document.getElementById('current-profile-image');
            if (currentImageElement && data.image) {
                currentImageElement.src = data.image;
                currentImageElement.style.display = 'block';
            }
            
            // ملء حقول وسائل التواصل الاجتماعي
            if (data.social) {
                const socialInputs = document.querySelectorAll('.social-input');
                socialInputs.forEach(input => {
                    const platform = input.getAttribute('data-platform');
                    if (platform && data.social[platform]) {
                        input.value = data.social[platform];
                    } else {
                        input.value = '';
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

// تحديث دالة إضافة رابط جديد لتفريغ حقل الصورة بشكل صحيح
document.getElementById('link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('link-title').value;
    const url = document.getElementById('link-url').value;
    const iconFile = document.getElementById('link-icon').files[0];
    
    try {
        let iconUrl = '';
        if (iconFile) {
            iconUrl = await uploadToImgBB(iconFile);
        }
        
        // إضافة timestamp وتعيين order بقيمة سالبة للوقت الحالي
        const timestamp = new Date();
        const order = -timestamp.getTime(); // قيمة سالبة للوقت لضمان ظهور الأحدث أولاً
        
        await addDoc(collection(db, 'links'), {
            title,
            url,
            icon: iconUrl,
            order: order,
            timestamp: timestamp,
            clicks: 0
        });
        
        // إعادة تعيين النموذج
        document.getElementById('link-form').reset();
        
        // إخفاء معاينة الصورة
        const preview = document.getElementById('link-icon-preview');
        if (preview) {
            preview.style.display = 'none';
        }
        
        // إعادة تعيين حقل الصورة بشكل صريح
        const iconInput = document.getElementById('link-icon');
        if (iconInput) {
            // إنشاء نسخة جديدة من حقل الإدخال لتفريغه تماماً
            const newInput = document.createElement('input');
            newInput.type = 'file';
            newInput.id = 'link-icon';
            newInput.name = 'link-icon';
            newInput.accept = 'image/*';
            
            // استبدال حقل الإدخال القديم بالجديد
            iconInput.parentNode.replaceChild(newInput, iconInput);
            
            // إعادة إعداد معاينة الصورة للحقل الجديد
            setupImagePreview('link-icon', 'link-icon-preview');
        }
        
        loadLinks();
        alert('Link added successfully!');
    } catch (error) {
        console.error('Error adding link:', error);
        alert('Error: ' + error.message);
    }
});

// إضافة وظيفة تعديل الرابط
window.editLink = async (id) => {
    try {
        // الحصول على بيانات الرابط
        const linkRef = doc(db, 'links', id);
        const linkSnap = await getDoc(linkRef);
        
        if (linkSnap.exists()) {
            const linkData = linkSnap.data();
            
            // إنشاء نموذج التعديل
            const editForm = document.createElement('div');
            editForm.className = 'edit-form-overlay';
            editForm.innerHTML = `
                <div class="edit-form">
                    <h3>Edit Link</h3>
                    <form id="edit-link-form">
                        <div class="form-group">
                            <label for="edit-link-title">Title</label>
                            <input type="text" id="edit-link-title" value="${linkData.title}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-link-url">URL</label>
                            <input type="url" id="edit-link-url" value="${linkData.url}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-link-icon">Icon (Leave empty to keep current)</label>
                            <input type="file" id="edit-link-icon" accept="image/*">
                            ${linkData.icon ? `<img src="${linkData.icon}" alt="Current Icon" class="current-icon">` : ''}
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="cancel-btn" onclick="closeEditForm()">Cancel</button>
                            <button type="submit" class="save-btn">Save Changes</button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(editForm);
            
            // معالجة تقديم النموذج
            document.getElementById('edit-link-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const title = document.getElementById('edit-link-title').value;
                const url = document.getElementById('edit-link-url').value;
                const iconFile = document.getElementById('edit-link-icon').files[0];
                
                const saveBtn = e.target.querySelector('.save-btn');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                
                try {
                    let iconUrl = linkData.icon;
                    
                    // تحديث الأيقونة إذا تم تحميل ملف جديد
                    if (iconFile) {
                        iconUrl = await uploadToImgBB(iconFile);
                    }
                    
                    // تحديث الرابط في Firestore
                    await updateDoc(linkRef, {
                        title,
                        url,
                        icon: iconUrl,
                        updatedAt: new Date()
                    });
                    
                    // إغلاق النموذج وتحديث القائمة
                    closeEditForm();
                    loadLinks();
                    alert('Link updated successfully');
                } catch (error) {
                    console.error('Error updating link:', error);
                    alert('Error: ' + error.message);
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            });
        }
    } catch (error) {
        console.error('Error loading link data:', error);
        alert('Error: ' + error.message);
    }
};

// إغلاق نموذج التعديل
window.closeEditForm = () => {
    const editForm = document.querySelector('.edit-form-overlay');
    if (editForm) {
        editForm.remove();
    }
};

// تحديث دالة loadLinks لإضافة زر التعديل
async function loadLinks() {
    const linksList = document.getElementById('links-list');
    linksList.innerHTML = '';

    const q = query(collection(db, 'links'), orderBy('order'));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach(doc => {
        const link = doc.data();
        const linkElement = document.createElement('div');
        linkElement.className = 'link-item';
        linkElement.innerHTML = `
            <div class="link-content">
                <div class="link-info">
                    <span class="link-title">${link.title}</span>
                    <span class="link-url">${link.url}</span>
                </div>
                ${link.icon ? `<img src="${link.icon}" alt="${link.title}" class="link-icon">` : ''}
            </div>
            <div class="link-actions">
                <button onclick="editLink('${doc.id}')" class="edit-btn">Edit</button>
                <button onclick="deleteLink('${doc.id}')" class="delete-btn">Delete</button>
            </div>
        `;
        linksList.appendChild(linkElement);
    });
}

// حذف رابط
window.deleteLink = async (id) => {
    if (confirm('Are you sure you want to delete this link?')) {
        await deleteDoc(doc(db, 'links', id));
        loadLinks();
    }
};

// تسجيل الخروج
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// تحميل البيانات عند فتح لوحة التحكم
document.addEventListener('DOMContentLoaded', () => {
    // إضافة عناصر معاينة الصور
    const profileImageInput = document.getElementById('profile-image-input');
    const linkIconInput = document.getElementById('link-icon');
    
    if (profileImageInput) {
        // إضافة عنصر لعرض الصورة الحالية
        const currentImageContainer = document.createElement('div');
        currentImageContainer.className = 'current-image-container';
        currentImageContainer.innerHTML = `
            <p>الصورة الحالية:</p>
            <img id="current-profile-image" class="current-icon" style="display: none; max-width: 100px; margin: 10px 0;">
        `;
        profileImageInput.parentNode.insertBefore(currentImageContainer, profileImageInput);
        
        // إضافة عنصر معاينة الصورة الجديدة
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        previewContainer.innerHTML = `
            <p>معاينة الصورة الجديدة:</p>
            <img id="profile-image-preview" class="image-preview" style="display: none; max-width: 100px; margin: 10px 0;">
        `;
        profileImageInput.parentNode.insertBefore(previewContainer, profileImageInput.nextSibling);
        setupImagePreview('profile-image-input', 'profile-image-preview');
    }
    
    if (linkIconInput) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        previewContainer.innerHTML = `
            <img id="link-icon-preview" class="image-preview" style="display: none; max-width: 50px; margin: 10px 0;">
        `;
        linkIconInput.parentNode.insertBefore(previewContainer, linkIconInput.nextSibling);
        setupImagePreview('link-icon', 'link-icon-preview');
    }
    
    // إضافة مستمع الحدث لزر تحديث الترتيب إذا كان موجوداً
    const updateOrderBtn = document.getElementById('update-order-btn');
    if (updateOrderBtn) {
        updateOrderBtn.addEventListener('click', updateAllLinksOrder);
    }
    
    // تحميل بيانات الملف الشخصي
    if (document.getElementById('profile-form')) {
        loadProfileData();
    }
    
    // تحميل الروابط
    loadLinks();
});

// إضافة دالة لتحديث ترتيب جميع الروابط
async function updateAllLinksOrder() {
    try {
        const q = query(collection(db, 'links'));
        const querySnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let counter = 0;
        
        querySnapshot.forEach((doc) => {
            const linkData = doc.data();
            // إذا كان هناك timestamp، استخدمه، وإلا استخدم ترتيب عكسي بناءً على العداد
            const timestamp = linkData.timestamp ? linkData.timestamp.toDate() : new Date();
            const order = -timestamp.getTime() - counter; // إضافة counter لتجنب التكرار
            
            batch.update(doc.ref, { order: order });
            counter++;
        });
        
        await batch.commit();
        alert('All links order updated successfully!');
        loadLinks();
    } catch (error) {
        console.error('Error updating links order:', error);
        alert('Error: ' + error.message);
    }
} 