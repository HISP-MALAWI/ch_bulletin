import React from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import classes from './App.module.css'
import HomePage from './Pages/home'
import BulletinForm from './Pages/newBulletin'
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsPage from './Pages/setting'
import { Inventory } from '@mui/icons-material'


const MyApp = () => {

    return (
        <HashRouter>
            <div className={classes.container}>
                {/* Sidebar Navigation */}
                <aside className={classes.sidebar}>
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

                    <NavLink 
                        to="/settings" 
                        className={({ isActive }) => 
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        <SettingsIcon style={{ marginRight: '8px' }} />
                        {i18n.t('Settings')}
                    </NavLink>
                </aside>

                <Routes>
                    <Route path="/" element={<HomePage style={classes}/>} />
                    <Route path="/new-bulletin" element={<BulletinForm style={classes}/>} />
                    <Route path="/settings" element={<SettingsPage styles={classes} />} />
                    </Routes>
            </div>
        </HashRouter>
    )
}

export default MyApp