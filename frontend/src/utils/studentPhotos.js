const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 512;

/** Validate and resize a teacher/admin-selected photo before upload. */
export const compressStudentPhoto = (file) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose a photo first.'));
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        return reject(new Error('Please choose a JPG or PNG image.'));
    }
    if (file.size > MAX_INPUT_BYTES) {
        return reject(new Error('Photo must be 5 MB or smaller.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not read the photo.'));
        image.onload = () => {
            const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Could not compress the photo.'));
                resolve(new File([blob], 'student-photo.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.82);
        };
        image.src = reader.result;
    };
    reader.readAsDataURL(file);
});
