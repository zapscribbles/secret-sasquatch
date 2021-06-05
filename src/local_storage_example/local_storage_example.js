function componentData() {
    return {
        updateStorage() {
            var currentDate = new Date();
            localStorage.setItem('current_date',currentDate.toString());
            console.log('Storage updated to', currentDate.toString())
        },
        retrieveStorage() {
            var retrievedData = localStorage.getItem('current_date');
            this.storageContents = retrievedData;
            console.log('Storage retrieved:', retrievedData)
        },
        storageContents: '',
    }
}

