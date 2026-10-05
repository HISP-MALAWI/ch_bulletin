import React from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import classes from './App.module.css'
import HomePage from './Pages/home'
import BulletinForm from './Pages/newBulletin'
import BulletinPreview from './Pages/bulletinPreview'
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsPage from './Pages/setting'
import { Inventory } from '@mui/icons-material'
import { AccessProvider, useAccess } from './context/AccessContext'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'


const MyApp = () => {
    const { loading, canDraft, canConfigure } = useAccess()
    const [isNavigationVisible, setIsNavigationVisible] = React.useState(true)

    // Hold gated routes until access resolves, otherwise a permitted user
    // reloading the URL would be bounced to Home mid-query.
    const gate = (allowed, element) => {
        if (loading) {
            return null
        }
        return allowed ? element : <Navigate to="/" replace />
    }

    return (
        <HashRouter>
            <div className={classes.container}>
                {/* Sidebar Navigation */}
                <aside
                    id="primary-navigation"
                    className={`${classes.sidebar} ${!isNavigationVisible ? classes.sidebarHidden : ''}`}
                    aria-hidden={!isNavigationVisible}
                >
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        <HomeIcon style={{ marginRight: '8px' }} />
                        {i18n.t('Home')}
                    </NavLink>

                    <NavLink
                        to="/archived-bulletins"
                        className={({ isActive }) =>
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        <Inventory style={{ marginRight: '8px' }} />
                        {i18n.t('Archived Bulletins')}
                    </NavLink>

                    {canConfigure && (
                        <NavLink
                            to="/settings"
                            className={({ isActive }) =>
                                isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                            }
                        >
                            <SettingsIcon style={{ marginRight: '8px' }} />
                            {i18n.t('Settings')}
                        </NavLink>
                    )}
                </aside>

                <button
                    type="button"
                    className={`${classes.navigationToggle} ${isNavigationVisible ? classes.navigationToggleOpen : ''}`}
                    onClick={() => setIsNavigationVisible((visible) => !visible)}
                    aria-controls="primary-navigation"
                    aria-expanded={isNavigationVisible}
                    aria-label={isNavigationVisible ? i18n.t('Hide navigation') : i18n.t('Show navigation')}
                    title={isNavigationVisible ? i18n.t('Hide navigation') : i18n.t('Show navigation')}
                >
                    {isNavigationVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>

                <div className={`${classes.appMain} ${!isNavigationVisible ? classes.appMainExpanded : ''}`}>
                    <Routes>
                        <Route path="/" element={<HomePage style={classes}/>} />
                        <Route path="/archived-bulletins" element={<HomePage style={classes}/>} />
                        <Route path="/new-bulletin" element={gate(canDraft, <BulletinForm style={classes}/>)} />
                        <Route path="/edit-bulletin/:id" element={gate(canDraft, <BulletinForm style={classes}/>)} />
                        <Route path="/bulletin/:id" element={<BulletinPreview style={classes}/>} />
                        <Route path="/settings" element={gate(canConfigure, <SettingsPage styles={classes} />)} />
                    </Routes>
                </div>
            </div>
        </HashRouter>
    )
}

const App = () => (
    <AccessProvider>
        <MyApp />
    </AccessProvider>
)

export default App
