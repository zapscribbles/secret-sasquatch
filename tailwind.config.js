module.exports = {
    purge: {
        content: ['_site/**/*.html'],
        options: {
            safelist: [],
        },
    },
    theme: {
        extend: {
            colors: {
                myBrown: '#5f2321',
                myBlue: '#284B63',
                myGreen: '#3C6E71',
            },
            fontFamily: {
                handwritten: ['Rancho', 'cursive'],
            },
        },
    },
    variants: {},
    plugins: [require('@tailwindcss/forms')],
};
