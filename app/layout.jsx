import './globals.css';

export const metadata = {
	title: 'BADS Card Atlases',
	description: 'Direct links to generated card atlases and misc assets.'
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
