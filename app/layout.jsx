import './globals.css';

export const metadata = {
	title: 'B2B AI SaaS Card Atlases',
	description: 'Direct links to generated card atlases and misc assets.'
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
